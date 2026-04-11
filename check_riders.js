import mongoose from "mongoose";
import Rider from "./models/Rider.js";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function checkRiders() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const riders = await Rider.find().populate('user', 'name email role').populate('retailer', 'name businessDetails');
        
        console.log("\n--- ALL REGISTERED RIDERS ---");
        riders.forEach(r => {
            console.log(`Rider Name: ${r.user?.name || 'UNKNOWN'}`);
            console.log(`Rider User ID: ${r.user?._id}`);
            console.log(`Retailer: ${r.retailer?.businessDetails?.businessName || r.retailer?.name || 'UNKNOWN'} (${r.retailer?._id})`);
            console.log(`Status: ${r.status}`);
            console.log('----------------------------');
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkRiders();
