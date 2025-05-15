import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/conectDB.js";
import viewEngine from "./config/viewEngine.js";
import initWebRoutes from "./route/web.js";

dotenv.config();

let app = express();

viewEngine(app);
app.use(cors({ origin: true }));

// Tăng giới hạn kích thước cho JSON và URL-encoded payloads
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Ghi đè lên limit các kiểu request
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

initWebRoutes(app);

connectDB();

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Backend Nodejs is running on port: ${port}`);
});
