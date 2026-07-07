const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["block", "numbered", "spacer", "row", "page-break"],
    },

    text: {
      type: String,
      default: "",
    },

    align: {
      type: String,
      enum: ["left", "right", "center", "justify"],
    },

    style: {
      type: String,
      default: "",
    },

    number: {
      type: String,
      default: "",
    },

    size: {
      type: String,
      default: "",
    },
    left: String,
    right: String,
  },
  { _id: false },
);

const templateSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    language: {
      type: String,
      default: "hi-IN",
    },

    category: {
      type: String,
      default: "General",
    },

    description: {
      type: String,
      default: "",
    },

    icon: {
      type: String,
      default: "",
    },

    builtin: {
      type: Boolean,
      default: false,
    },

    version: {
      type: Number,
      default: 1,
    },

    blocks: [blockSchema],
  },
  {
    timestamps: true,
  },
);

templateSchema.index({
  category: 1,
  language: 1,
});

const Template = mongoose.model("Template", templateSchema);

module.exports = Template;
