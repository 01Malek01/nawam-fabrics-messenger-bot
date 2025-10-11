const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { airtableService } = require("./services/airtable");
const {
  fetchCategories,
  findCategoryById,
  findSubcategoryById,
  getCategoryInfoText,
} = require("./utils/categoryUtils");
const {
  createCategoryButtons,
  createQuickReply,
  createTextMessage,
} = require("./utils/messageUtils");
require("dotenv").config();

// Default image URL for categories without images
const DEFAULT_CATEGORY_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAgEn5bBp8A3v5TMgmG_Xy30ZssTkQ8uJQAkn9gjKJvFTKqVKFHIOVfsEWTffLVupooswoJqnDc2pwIS3RFtU8Y2nx3tuFu2A6cdTRVdJ-0zdiZBOmRiFOvmKQGlFK8ViKl_t7BjzhTIi-k9S3DqfghfDdi6L_x8J5uT-4nKcla4hFpaPprg2XU4LthpdL30Fbu88v8p-bqOjfnmxRs-Jhvu-JZQsTMUBEb-j5TB5P-GDg1712IqY5Fe-4yfiTk5UreQ_nUBDL02pY";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Facebook Messenger configuration
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Store categories in memory
let categories = [];

// Initialize categories on startup
const initializeCategories = async () => {
  categories = await fetchCategories();
};

initializeCategories();

// Webhook verification endpoint
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook endpoint for receiving messages
app.post("/webhook", (req, res) => {
  const body = req.body;
  console.log("Webhook received body:", JSON.stringify(body, null, 2));

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      const webhookEvent = entry.messaging[0];
      // console.log("Webhook event:", JSON.stringify(webhookEvent, null, 2));

      // Get the sender PSID
      const senderPsid = webhookEvent.sender.id;
      // console.log("Sender PSID:", senderPsid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhookEvent.message) {
        console.log("Handling message event");
        handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        console.log("Handling postback event:", webhookEvent.postback);
        handlePostback(senderPsid, webhookEvent.postback);
      } else {
        console.log("Unknown event type received:", Object.keys(webhookEvent));
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Function to show categories menu with pagination
function showCategories(senderPsid, page = 0) {
  console.log(`Showing categories menu, page ${page}`);
  console.log("Categories count:", categories.length);
  // Make sure we have categories before proceeding
  if (!categories || categories.length === 0) {
    console.error("No categories available");
    return callSendAPI(
      senderPsid,
      createTextMessage(
        "عذراً، لا توجد فئات متاحة حالياً. يرجى المحاولة لاحقاً."
      )
    );
  }

  try {
    const response = createCategoryButtons(categories, false, page);
    callSendAPI(senderPsid, response);
  } catch (error) {
    console.error("Error creating category buttons:", error);
    callSendAPI(
      senderPsid,
      createTextMessage("حدث خطأ أثناء تحميل الفئات. يرجى المحاولة مرة أخرى.")
    );
  }
}

// Handles messages events
function handleMessage(senderPsid, receivedMessage) {
  console.log("Received message:", receivedMessage);

  // Check if this is a quick reply with browse_categories payload
  if (
    receivedMessage.quick_reply &&
    receivedMessage.quick_reply.payload === "browse_categories"
  ) {
    return showCategories(senderPsid);
  }

  // For any other message, show the welcome message with quick replies
  const response = {
    text: "مرحباً! أهلاً وسهلاً بك في أقمشة النوام. اختر فئة الأقمشة التي تريدها:",
    quick_replies: [
      {
        content_type: "text",
        title: "تصفح الفئات",
        payload: "browse_categories",
      },
      {
        content_type: "text",
        title: "المساعدة",
        payload: "help",
      },
    ],
  };

  // Sends the response message
  callSendAPI(senderPsid, response);
}

// Handles messaging_postbacks events
function handlePostback(senderPsid, receivedPostback) {
  console.log("handlePostback called with:", { senderPsid, receivedPostback });
  let response;

  // Get the payload for the postback
  let payload = receivedPostback ? receivedPostback.payload : null;

  if (!payload) {
    console.error("No payload found in postback:", receivedPostback);
    return;
  }

  // Handle different postback payloads
  if (payload === "browse_categories" || payload === "back_to_categories") {
    console.log("Showing categories menu from postback");
    return showCategories(senderPsid, 0); // Always start at page 0
  } else if (payload.startsWith("more_categories_")) {
    // Handle pagination for main categories
    const page = parseInt(payload.replace("more_categories_", ""));
    if (isNaN(page) || page < 0) {
      console.error("Invalid page number:", page);
      return showCategories(senderPsid, 0);
    }
    console.log(`Showing more categories, page ${page}`);
    return showCategories(senderPsid, page);
  } else if (payload.startsWith("more_subcategories_")) {
    // Handle pagination for subcategories
    const [_, parentCategoryId, pageStr] = payload.match(
      /^more_subcategories_(.+?)_(\d+)$/
    );
    const page = parseInt(pageStr);
    const parentCategory = findCategoryById(categories, parentCategoryId);

    if (!parentCategory || !parentCategory.subCategories) {
      console.error("Parent category or subcategories not found");
      return showCategories(senderPsid);
    }

    console.log(
      `Showing more subcategories for ${parentCategory.name}, page ${page}`
    );
    return callSendAPI(
      senderPsid,
      createCategoryButtons(
        parentCategory.subCategories,
        true,
        page,
        parentCategoryId
      )
    );
  } else if (payload === "help") {
    response = createTextMessage(
      "مرحباً! يمكنني مساعدتك في تصفح فئات الأقمشة. فقط اضغط على 'تصفح الفئات' للبدء!"
    );
  } else if (payload.startsWith("category_")) {
    // Handle main category selection
    const categoryId = payload.replace("category_", "");
    const category = findCategoryById(categories, categoryId);

    if (category) {
      if (category.subCategories && category.subCategories.length > 0) {
        // Show subcategories
        console.log("sub categories:", category.subCategories);
        response = createCategoryButtons(
          category.subCategories,
          true,
          0,
          category.id
        );
      } else {
        // No subcategories, fetch and show products for this category
        console.log(
          `Fetching products for category: ${category.name} (${categoryId})`
        );
        airtableService
          .getAllRecords("Products")
          .then((products) => {
            // Filter products for this category
            const categoryProducts = products.filter(
              (p) => p.MainCategory && p.MainCategory.includes(categoryId)
            );

            if (categoryProducts.length > 0) {
              // Create product carousel
              const elements = categoryProducts.map((product) => ({
                title: product.Name,
                subtitle: `Price per meter: ${product.PricePerMeter || "N/A"}`,
                image_url: product.Image?.[0]?.url || DEFAULT_CATEGORY_IMAGE,
              }));

              // Send the carousel
              callSendAPI(senderPsid, {
                attachment: {
                  type: "template",
                  payload: {
                    template_type: "generic",
                    elements: elements.slice(0, 10), // Facebook allows max 10 items in carousel
                  },
                },
              });
            } else {
              callSendAPI(
                senderPsid,
                createTextMessage("No products found in this category.")
              );
            }
          })
          .catch((error) => {
            console.error("Error fetching products:", error);
            callSendAPI(
              senderPsid,
              createTextMessage(
                "Sorry, there was an error loading products. Please try again later."
              )
            );
          });
        return; // Return early since we're handling the response asynchronously
      }
    } else {
      response = createTextMessage("Category not found. Please try again.");
    }
  } else if (payload.startsWith("subcategory_")) {
    // Handle subcategory selection
    const subcategoryId = payload.replace("subcategory_", "");
    console.log("Fetching products for subcategory ID:", subcategoryId);

    // Find the parent category that contains this subcategory
    const parentCategory = categories.find(
      (cat) =>
        cat.subCategories &&
        cat.subCategories.some((sub) => sub.id === subcategoryId)
    );

    if (!parentCategory) {
      console.error(
        "Parent category not found for subcategory:",
        subcategoryId
      );
      return callSendAPI(
        senderPsid,
        createTextMessage("Error: Could not find parent category.")
      );
    }

    // Fetch products for this subcategory
    airtableService
      .getAllRecords("Products")
      .then((products) => {
        // Filter products for this subcategory
        const subcategoryProducts = products.filter(
          (p) => p.SubCategory && p.SubCategory.includes(subcategoryId)
        );

        if (subcategoryProducts.length > 0) {
          // Create product carousel
          const elements = subcategoryProducts.map((product) => ({
            title: product.Name,
            subtitle: `Price per meter: ${product.PricePerMeter || "N/A"}`,
            image_url: product.Image?.[0]?.url || DEFAULT_CATEGORY_IMAGE,
          }));

          // Send the carousel
          callSendAPI(senderPsid, {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements: elements.slice(0, 10), // Facebook allows max 10 items in carousel
              },
            },
          });
        } else {
          callSendAPI(
            senderPsid,
            createTextMessage("No products found in this subcategory.")
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching products:", error);
        callSendAPI(
          senderPsid,
          createTextMessage(
            "Sorry, there was an error loading products. Please try again later."
          )
        );
      });
    return; // Return early since we're handling the response asynchronously
  } else if (payload.startsWith("view_products_")) {
    // Handle view products
    const categoryId = payload.replace("view_products_", "");
    const category = findCategoryById(categories, categoryId);

    if (category) {
      response = createTextMessage(
        `Viewing products for: ${category.name}\n\nThis feature will be implemented soon! For now, you can browse our categories.`
      );
    } else {
      response = createTextMessage("Category not found. Please try again.");
    }
  } else if (payload === "yes") {
    response = createTextMessage("Thanks!");
  } else if (payload === "no") {
    response = createTextMessage("Oops, try sending another image.");
  } else {
    // Default response
    response = createCategoryButtons(categories);
  }

  // Send the message to acknowledge the postback
  callSendAPI(senderPsid, response);
}

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {
  try {
    // Validate sender PSID
    if (!senderPsid) {
      throw new Error("Missing sender PSID");
    }

    // Validate response
    if (!response) {
      throw new Error("Missing response object");
    }

    // Construct the message body
    let requestBody = {
      recipient: {
        id: senderPsid.toString(), // Ensure PSID is a string
      },
      message: response,
      messaging_type: "RESPONSE",
    };

    console.log(
      "Sending message with payload:",
      JSON.stringify(requestBody, null, 2)
    );

    // Send the HTTP request to the Messenger Platform
    const url = `https://graph.facebook.com/v2.6/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

    return axios
      .post(url, requestBody, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      })
      .then((apiResponse) => {
        console.log(
          "Message sent successfully:",
          JSON.stringify(apiResponse.data, null, 2)
        );
        return apiResponse.data;
      })
      .catch((error) => {
        console.error("Error sending message:");

        const errorDetails = {
          timestamp: new Date().toISOString(),
          error: {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack,
          },
          response: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers,
              }
            : null,
          request: {
            method: error.config?.method,
            url: error.config?.url,
            headers: error.config?.headers,
            data: error.config?.data ? JSON.parse(error.config.data) : null,
          },
        };

        console.error("Error details:", JSON.stringify(errorDetails, null, 2));

        // Try to send an error message to the user
        if (senderPsid) {
          const errorMessage = {
            text: "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
          };

          axios
            .post(url, {
              recipient: { id: senderPsid },
              message: errorMessage,
              messaging_type: "RESPONSE",
            })
            .catch((e) => {
              console.error("Failed to send error message to user:", e.message);
            });
        }

        throw error; // Re-throw the error for further handling
      });
  } catch (error) {
    console.error("Unexpected error in callSendAPI:", error);
    return Promise.reject(error);
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
