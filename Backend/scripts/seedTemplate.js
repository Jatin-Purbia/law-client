    require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Template = require("../models/Template.model");

async function seedTemplates() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    console.log("MongoDB Connected");

    const templatesDir = path.join(__dirname, "../templates");

    const files = fs
      .readdirSync(templatesDir)
      .filter((file) => file.endsWith(".json"));

    let insertedCount = 0;

    for (const file of files) {
      const json = JSON.parse(
        fs.readFileSync(path.join(templatesDir, file), "utf8")
      );

      const exists = await Template.findOne({
        templateKey: json.id,
      });

      if (exists) {
        console.log(`Skipped: ${json.name}`);
        continue;
      }

      await Template.create({
        templateKey: json.id,
        name: json.name,
        language: json.language,
        description: json.description,
        category: json.category,
        icon: json.icon,
        builtin: json.builtin,
        version: 1,
        blocks: json.blocks,
      });

      insertedCount++;

      console.log(`Inserted: ${json.name}`);
    }

    console.log(`Done. ${insertedCount} templates inserted`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedTemplates();