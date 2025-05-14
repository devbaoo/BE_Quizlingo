'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const db = {};
const basename = path.basename(__filename);

// 🔹 Tạo URL kết nối MongoDB từ biến môi trường `.env`
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/my_database';

// 🔹 Kết nối MongoDB
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const dbConnection = mongoose.connection;

dbConnection.on('error', (err) => {
    console.error('❌ MongoDB Connection Error:', err);
});

dbConnection.once('open', () => {
    console.log('✅ MongoDB Connected Successfully!');
});

// 🔹 Import tất cả model trong thư mục `models`
fs.readdirSync(__dirname)
    .filter((file) => file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js')
    .forEach((file) => {
        const model = require(path.join(__dirname, file));
        db[model.modelName] = model;
    });

db.mongoose = mongoose;
db.connection = dbConnection;

module.exports = db;
