import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const connectDB = async () => {
    try {
        // Optimized MongoDB connection for high concurrency
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,

            // Connection Pool Settings
            maxPoolSize: 50,          // Maximum number of connections
            minPoolSize: 5,           // Minimum number of connections  
            maxIdleTimeMS: 30000,     // Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS: 5000,  // How long to try selecting a server
            socketTimeoutMS: 45000,   // How long a send or receive on a socket can take

            // Heartbeat Settings
            heartbeatFrequencyMS: 10000,  // How often to check server status

            // Buffer Settings
            bufferMaxEntries: 0,      // Disable mongoose buffering
            bufferCommands: false,    // Disable mongoose buffering

            // Write Concern (for better performance in high load)
            writeConcern: {
                w: 1,                   // Acknowledge writes to primary only
                j: false                // Don't wait for journal
            }
        });

        console.log("✅ MongoDB Connected with optimized settings...");
        console.log(`📊 Connection pool: min=${5}, max=${50}`);

        // Monitor connection events
        mongoose.connection.on('connected', () => {
            console.log('📡 Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ Mongoose connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('📴 Mongoose disconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('📴 MongoDB connection closed through app termination');
            process.exit(0);
        });

    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
};

export default connectDB;
