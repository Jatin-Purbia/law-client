const express = require("express");

const {
  createDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  updateDocument,
} = require("../controllers/document.controller.js");


const router = express.Router();

/* =========================
   ROUTES
========================= */
router.post("/", createDocument);

router.get("/", getDocuments);

router.get("/:id", getDocumentById);
router.delete("/:id", deleteDocument);
router.put("/:id", updateDocument);

module.exports = router;
