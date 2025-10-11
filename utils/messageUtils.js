/**
 * Helper function to create category buttons with pagination
 * @param {Array} categoryList - Array of categories to create buttons for
 * @param {boolean} isSubCategory - Whether these are subcategory buttons
 * @param {number} page - Current page number (0-based)
 * @param {number} pageSize - Number of categories per page (max 3 for Facebook)
 * @returns {Object|Array} Facebook Messenger button template(s)
 */
const createCategoryButtons = (
  categoryList,
  isSubCategory = false,
  page = 0,
  parentCategoryId = null
) => {
  // Always show exactly 2 buttons per message (or fewer if not enough categories)
  const BUTTONS_PER_PAGE = 2;
  const startIndex = page * BUTTONS_PER_PAGE;
  const endIndex = startIndex + BUTTONS_PER_PAGE;
  const paginatedCategories = categoryList.slice(startIndex, endIndex);
  const hasMore = endIndex < categoryList.length;

  // console.log(`Creating ${isSubCategory ? 'subcategory' : 'category'} buttons - Page ${page}, Showing ${paginatedCategories.length} of ${categoryList.length} items`);

  // Create main buttons for categories
  const buttons = paginatedCategories.map((category) => ({
    type: "postback",
    title: category.name,
    payload: isSubCategory
      ? `subcategory_${category.id}`
      : `category_${category.id}`,
  }));

  // Add navigation buttons (max 1 button to stay under 3-button limit)
  const navButtons = [];

  // Only add one navigation button to stay under the limit
  if (hasMore) {
    // If there are more items, show more button with appropriate payload
    const morePayload = isSubCategory && parentCategoryId
      ? `more_subcategories_${parentCategoryId}_${page + 1}`
      : `more_categories_${page + 1}`;
      
    const buttonTitle = isSubCategory 
      ? `المزيد من الفئات الفرعية (${page + 2}/${Math.ceil(categoryList.length / 2)}) →`
      : `المزيد من الفئات (${page + 2}/${Math.ceil(categoryList.length / 2)}) →`;
      
    navButtons.push({
      type: "postback",
      title: buttonTitle,
      payload: morePayload,
    });
  } else if (isSubCategory || page > 0) {
    // Only show back button if not showing "More" button
    navButtons.push({
      type: "postback",
      title: isSubCategory ? "← العودة للفئات" : "← القائمة الرئيسية",
      payload: isSubCategory ? "back_to_categories" : "browse_categories",
    });
  }

  // Combine all buttons (category buttons first, then navigation)
  const allButtons = [...buttons, ...navButtons];

  // Create the message template
  const message = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: isSubCategory
          ? "اختر فئة فرعية:"
          : page === 0
          ? "مرحباً! أهلاً وسهلاً بك في أقمشة النوام. اختر فئة الأقمشة:"
          : "المزيد من الفئات المتاحة:",
        buttons: allButtons,
      },
    },
  };

  return message;
};

/**
 * Helper function to create category carousel
 * @param {Array} categoryList - Array of categories to create carousel for
 * @returns {Object} Facebook Messenger carousel template
 */
const createCategoryCarousel = (categoryList) => {
  const elements = categoryList.slice(0, 10).map((category) => ({
    title: category.name,
    subtitle: category.description || `Products: ${category.productsCount}`,
    image_url: category.imageUrl,
    buttons: [
      {
        type: "postback",
        title:
          category.subCategories.length > 0
            ? "View Subcategories"
            : "View Products",
        payload:
          category.subCategories.length > 0
            ? `category_${category.id}`
            : `view_products_${category.id}`,
      },
    ],
  }));

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: elements,
      },
    },
  };
};

/**
 * Create a quick reply message
 * @param {string} text - Main message text
 * @param {Array} quickReplies - Array of quick reply options
 * @returns {Object} Facebook Messenger quick reply message
 */
const createQuickReply = (text, quickReplies) => {
  return {
    text: text,
    quick_replies: quickReplies,
  };
};

/**
 * Create a simple text message
 * @param {string} text - Message text
 * @returns {Object} Facebook Messenger text message
 */
const createTextMessage = (text) => {
  return { text: text };
};

module.exports = {
  createCategoryButtons,
  createCategoryCarousel,
  createQuickReply,
  createTextMessage,
};
