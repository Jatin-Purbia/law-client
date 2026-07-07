const asyncHandler = require("../Middlewares/asyncHandler");
const Template = require("../models/Template.model");

// Get all tampletes

exports.getTemplates = asyncHandler(async (req, res) => {
  const templates = await Template.find().sort({ createdAt: -1 });

  res.json({
    success: true,
    data: templates,
  });
});