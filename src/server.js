import express from "express";
import bodyParser from "body-parser";
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/conectDB.js';
import viewEngine from "./config/viewEngine";
import initWebRoutes from './route/web.js';

dotenv.config();  // Load biến môi trường từ .env

let app = express();
app.use(cors({ origin: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

viewEngine(app);
initWebRoutes(app);

connectDB(); // Kết nối MongoDB thay vì MySQL

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`🚀 Backend Nodejs is running on port: ${port}`);
});
