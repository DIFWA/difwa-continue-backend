import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    throw new Error("Please define the MONGO_URI environment variable inside .env");
}

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false, // Disable Mongoose buffering
        };

        cached.promise = mongoose.connect(MONGO_URI, opts).then((mongoose) => {
            console.log("MongoDB Connected 🚀");
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error("Database Connection Failed ❌", e.message);
        throw e;
    }

    return cached.conn;
};

export default connectDB;
