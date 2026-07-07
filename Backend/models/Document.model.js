const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    templateKey: String,
    templateName: String,

    title: String,

    pages: [String],

    formValues: {
      type: Object,
      default: {},
    },

    status: {
      type: String,
      default: "draft",
    },
  },
  {
    timestamps: true,
  },
);

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
