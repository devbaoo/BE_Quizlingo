"use strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ES Module file path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = {};
const basename = path.basename(__filename);

// 🔹 Tạo URL kết nối MongoDB từ biến môi trường `.env`
const mongoURI =
  process.env.MONGO_URI || "mongodb://localhost:27017/my_database";

// 🔹 Kết nối MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const dbConnection = mongoose.connection;

dbConnection.on("error", (err) => {
  console.error("❌ MongoDB Connection Error:", err);
});

dbConnection.once("open", () => {
  console.log("✅ MongoDB Connected Successfully!");
});

// 🔹 Import tất cả model trong thư mục `models`
// Note: Dynamic imports with ES modules works differently
// This approach may need refactoring later with dynamic imports
// For now, we'll manually import models as needed in the application

db.mongoose = mongoose;
db.connection = dbConnection;

export default db;
