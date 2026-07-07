require("dotenv").config({
  quiet: true,
});
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const errorHandler = require("./Middlewares/error.middleware");

const templateRoutes = require("./routes/template.routes");
const documentRoutes = require("./routes/document.routes");

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

app.get("/", (req, res) => {
  res.send("Agreement Backend Running 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

app.use("/api/templates", templateRoutes);
app.use("/api/documents", documentRoutes);

app.use(errorHandler);

module.exports = app;
