import mongoose from "mongoose";
import User from "./models/User.js";
import AppUser from "./models/AppUser.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
import CommissionSetting from "./models/CommissionSetting.js";
import dotenv from "dotenv";

dotenv.config();

async function simulate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // 1. Find Retailer
        const retailer = await User.findOne({ email: "retailer2@shrimpbite.com" });
        if (!retailer) {
            console.error("Retailer not found!");
            process.exit(1);
        }
        console.log(`Found Retailer: ${retailer.name} (${retailer._id})`);

        // 2. Find/Create a Customer
        let customer = await AppUser.findOne({ phoneNumber: "9876543210" });
        if (!customer) {
            customer = await AppUser.create({
                fullName: "Test Customer",
                phoneNumber: "9876543210",
                isVerified: true
            });
            console.log("Created Test Customer");
        }

        // 3. Find a Product belonging to this retailer
        let product = await Product.findOne({ retailer: retailer._id });
        if (!product) {
            product = await Product.create({
                name: "Test Water Can",
                price: 500,
                unit: "Cans",
                retailer: retailer._id,
                stock: 100,
                category: new mongoose.Types.ObjectId() // Dummy cat
            });
            console.log("Created Test Product");
        }

        // 4. Get Current Commission Rate
        const setting = await CommissionSetting.findOne({ isActive: true });
        const rate = setting ? setting.rate : 10;
        console.log(`Current Commission Rate: ${rate}%`);

        // 5. Create Order for 2 units (Total 1000)
        const totalAmount = product.price * 2;
        const commissionAmount = (totalAmount * rate) / 100;

        const orderId = `TEST-FLOW-${Date.now()}`;
        const order = await Order.create({
            orderId,
            user: customer._id,
            items: [{
                product: product._id,
                retailer: retailer._id,
                quantity: 2,
                price: product.price,
                status: "Delivered" // Set to Delivered so it shows in earnings
            }],
            totalAmount,
            status: "Delivered",
            paymentStatus: "Paid",
            paymentMethod: "Cash",
            commissionRate: rate,
            commissionAmount: commissionAmount
        });

        console.log("-----------------------------------------");
        console.log("✅ TEST ORDER SUCCESSFUL");
        console.log(`Order ID: ${orderId}`);
        console.log(`Total Amount: ₹${totalAmount}`);
        console.log(`Commission (${rate}%): ₹${commissionAmount}`);
        console.log(`Retailer Net: ₹${totalAmount - commissionAmount}`);
        console.log("-----------------------------------------");
        console.log("You can now check the Revenue page for retailer2@shrimpbite.com");

        await mongoose.disconnect();
    } catch (err) {
        console.error("Simulation failed:", err);
        process.exit(1);
    }
}

simulate();
