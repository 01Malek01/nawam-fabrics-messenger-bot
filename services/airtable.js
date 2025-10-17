const Airtable = require("airtable");
const dotenv = require("dotenv");
dotenv.config();
// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_TOKEN,
}).base(process.env.AIRTABLE_BASE_ID);

const airtableService = {
  // Get all records
  async getAllRecords(tableName = "Products") {
    try {
      const records = await base(tableName).select().all();
      return records.map((record) => ({
        id: record.id,
        ...record.fields,
      }));
    } catch (error) {
      console.error("Error fetching records:", error);
      throw error;
    }
  },

  // Get single record by ID
  async getRecordById(id, tableName = "Products") {
    try {
      const record = await base(tableName).find(id);
      return {
        id: record.id,
        ...record.fields,
      };
    } catch (error) {
      console.error("Error fetching record:", error);
      throw error;
    }
  },
};

// airtableService.getAllRecords("Products").then((products) => {
//   console.log("Products:", products);
// });
module.exports = { airtableService };
