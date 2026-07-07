const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error(
      "Missing MONGODB_URL. Create Backend/.env and set MONGODB_URL to your MongoDB connection string.",
    );
  }

  try {
    await mongoose.connect(mongoUrl);

    console.log("MongoDB connected");

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB Error:", err.message);
    });
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
};

module.exports = connectDB;
