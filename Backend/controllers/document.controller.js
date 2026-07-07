const Document = require("../models/Document.model");
const asyncHandler = require("../Middlewares/asyncHandler");

const createDocument = asyncHandler(async (req, res) => {
  const document = await Document.create(req.body);

  res.status(201).json({
    success: true,
    data: document,
  });
});

const getDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find().sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    data: documents,
  });
});

const getDocumentById = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  res.json({
    success: true,
    data: document,
  });
});

const deleteDocument = asyncHandler(async (req, res) => {
  await Document.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: "Document deleted successfully",
  });
});

const updateDocument = asyncHandler(async (req, res) => {
  const document = await Document.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: document,
  });
});

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  updateDocument,
};
