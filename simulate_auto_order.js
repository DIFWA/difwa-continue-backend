import mongoose from "mongoose";
import User from "./models/User.js";
import AppUser from "./models/AppUser.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
import Rider from "./models/Rider.js";
import dotenv from "dotenv";

dotenv.config();

async function simulateAuto() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // 1. Find the specific Retailer
        const retailer = await User.findOne({ email: 'retailer2@shrimpbite.com' });
        if (!retailer) {
            console.error("Retailer retailer2@shrimpbite.com not found!");
            process.exit(1);
        }
        console.log(`Found Retailer: ${retailer.businessDetails?.businessName || retailer.name} (${retailer._id})`);

        // 2. Find/Create a Customer
        let customer = await AppUser.findOne({ phoneNumber: "9876543210" });
        if (!customer) {
            customer = await AppUser.create({
                fullName: "Auto Test Customer",
                phoneNumber: "9876543210",
                isVerified: true
            });
            console.log("Created Test Customer");
        }

        // 3. Find a Product belonging to this retailer
        let product = await Product.findOne({ retailer: retailer._id });
        if (!product) {
            product = await Product.create({
                name: "Shrimp Bites (Auto Test)",
                price: 500,
                unit: "kg",
                retailer: retailer._id,
                stock: 100,
                category: new mongoose.Types.ObjectId()
            });
            console.log("Created Test Product for this retailer");
        }

        // 4. Ensure there is an available rider for this retailer
        let rider = await Rider.findOne({ retailer: retailer._id });
        if (!rider) {
            // Create a dummy rider user if needed
            const riderUser = await User.create({
                name: "Express Delivery Rider",
                email: `rider_${Date.now()}@shrimpbite.com`,
                password: "hashed_password",
                role: "rider",
                status: "approved"
            });
            rider = await Rider.create({
                user: riderUser._id,
                retailer: retailer._id,
                status: "Available"
            });
            console.log("Created Test Rider for this retailer");
        } else {
             await Rider.updateOne({ _id: rider._id }, { $set: { status: "Available" } });
             console.log("Made existing rider 'Available'");
        }

        // 5. Create PENDING Order
        const orderId = `VND-AUTO-${Date.now()}`;
        const order = await Order.create({
            orderId,
            user: customer._id,
            items: [{
                product: product._id,
                retailer: retailer._id,
                quantity: 1,
                price: product.price,
                status: "Pending"
            }],
            totalAmount: product.price,
            status: "Pending",
            paymentStatus: "Pending",
            paymentMethod: "Cash",
            deliveryAddress: { address: "123 Auto Lane", city: "Test City" }
        });

        console.log("-----------------------------------------");
        console.log("✅ CUSTOMER ORDER CREATED FOR THIS VENDOR");
        console.log(`Order ID: ${orderId}`);
        console.log(`Retailer: ${retailer.businessDetails?.businessName || retailer.name}`);
        console.log(`Target Email: ${retailer.email}`);
        console.log("-----------------------------------------");
        console.log("WAITING FOR VENDOR TO ACTIVATED 'AUTO-PROCESS'...");

        await mongoose.disconnect();
    } catch (err) {
        console.error("Simulation failed:", err);
        process.exit(1);
    }
}

simulateAuto();
