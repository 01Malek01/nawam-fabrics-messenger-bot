const { airtableService } = require("../services/airtable");

// Default image URL for categories without images
const DEFAULT_CATEGORY_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAgEn5bBp8A3v5TMgmG_Xy30ZssTkQ8uJQAkn9gjKJvFTKqVKFHIOVfsEWTffLVupooswoJqnDc2pwIS3RFtU8Y2nx3tuFu2A6cdTRVdJ-0zdiZBOmRiFOvmKQGlFK8ViKl_t7BjzhTIi-k9S3DqfghfDdi6L_x8J5uT-4nKcla4hFpaPprg2XU4LthpdL30Fbu88v8p-bqOjfnmxRs-Jhvu-JZQsTMUBEb-j5TB5P-GDg1712IqY5Fe-4yfiTk5UreQ_nUBDL02pY";

/**
 * Create a category object with proper structure
 * @param {Object} categoryData - Raw category data from Airtable
 * @param {Array} subCategories - Array of subcategory data
 * @returns {Object} Formatted category object
 */
const createCategory = (categoryData, subCategories = []) => {
  console.log('Creating category:', {
    id: categoryData.id,
    name: categoryData.Name,
    subCategories: subCategories.map(s => ({ id: s.id, name: s.Name }))
  });
  
  const category = {
    id: categoryData.id,
    name: categoryData.Name,
    subCategories: subCategories.map((sub) => ({
      id: sub.id,
      name: sub.Name || sub.name, // Handle both Name and name cases
    })),
  };
  
  console.log('Created category object:', JSON.stringify(category, null, 2));
  return category;
};

/**
 * Fetch categories from Airtable and organize them with subcategories
 * @returns {Promise<Array>} Array of formatted categories with subcategories
 */
const fetchCategories = async () => {
  try {
    const allCategories = await airtableService.getAllRecords("Categories");
    console.log("fetched categories", allCategories);
    // Separate main categories (no parent) from subcategories
    const mainCategories = allCategories.filter(
      (category) => !category?.ParentCategory
    );
    const subCategories = allCategories.filter(
      (category) => category?.ParentCategory?.length > 0
    );

    console.log("main categories", mainCategories);
    console.log("sub categories", subCategories);
    // Map through main categories and attach their subcategories
    const categoriesWithSubs = mainCategories.map((category) => {
      // Find subcategories for this main category
      const categorySubs = subCategories
        .filter((sub) => sub.ParentCategory.includes(category.id))
        .map((sub) => ({
          id: sub.id,
          name: sub.Name,
        }));

      return createCategory(category, categorySubs);
    });

    console.log(
      `Loaded ${categoriesWithSubs.length} main categories with subcategories`
    );
    return categoriesWithSubs;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

/**
 * Find a category by ID
 * @param {Array} categories - Array of categories to search in
 * @param {string} categoryId - ID of the category to find
 * @returns {Object|null} Found category or null
 */
const findCategoryById = (categories, categoryId) => {
  return categories.find((cat) => cat.id === categoryId);
};

/**
 * Find a subcategory by ID across all categories
 * @param {Array} categories - Array of categories to search in
 * @param {string} subcategoryId - ID of the subcategory to find
 * @returns {Object|null} Found subcategory or null
 */
const findSubcategoryById = (categories, subcategoryId) => {
  console.log('Searching for subcategory ID:', subcategoryId);
  for (let category of categories) {
    console.log('Checking category:', category.name, 'with subcategories:', category.subCategories);
    const subcategory = category.subCategories?.find(
      (sub) => {
        console.log('Checking subcategory:', sub);
        return sub.id === subcategoryId;
      }
    );
    if (subcategory) {
      console.log('Found subcategory:', subcategory);
      return subcategory;
    }
  }
  console.log('Subcategory not found');
  return null;
};

/**
 * Get formatted category info text
 * @param {Object} category - Category object
 * @returns {string} Formatted text with category information
 */
const getCategoryInfoText = (category) => {
  return `You selected: ${category.name}\n`;
};

fetchCategories();
module.exports = {
  fetchCategories,
  createCategory,
  findCategoryById,
  findSubcategoryById,
  getCategoryInfoText,
  DEFAULT_CATEGORY_IMAGE,
};
