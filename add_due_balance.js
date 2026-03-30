import mongoose from "mongoose";
import User from "./models/User.js";
import AppUser from "./models/AppUser.js";
import Order from "./models/Order.js";
import CommissionSetting from "./models/CommissionSetting.js";
import Product from "./models/Product.js";
import dotenv from "dotenv";

dotenv.config();

async function addDue() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // 1. Find Retailer (Sea Blue Frozen)
        const retailer = await User.findOne({ email: "retailer2@shrimpbite.com" });
        if (!retailer) {
            console.error("Retailer not found!");
            process.exit(1);
        }

        // 2. Find Customer (Manual User)
        const phoneNumber = "7412369850";
        let customer = await AppUser.findOne({ phoneNumber });
        if (!customer) {
            console.error("Customer not found!");
            process.exit(1);
        }

        // 3. Find a Product (to create a valid order)
        let product = await Product.findOne({ retailer: retailer._id });
        if (!product) {
            console.error("Product not found for this retailer!");
            process.exit(1);
        }

        // 4. Calculate Commission
        const setting = await CommissionSetting.findOne({ isActive: true });
        const rate = setting ? setting.rate : 1;
        const totalAmount = 1000;
        const commissionAmount = (totalAmount * rate) / 100;

        // 5. Create the "Due" Order
        const orderId = `DUE-TEST-${Date.now()}`;
        await Order.create({
            orderId,
            user: customer._id,
            items: [{
                product: product._id,
                retailer: retailer._id,
                quantity: 2,
                price: 500,
                status: "Delivered"
            }],
            totalAmount,
            status: "Delivered",
            paymentStatus: "Due",
            paymentMethod: "Cash",
            commissionRate: rate,
            commissionAmount: commissionAmount
        });
        console.log(`Created Due Order: ${orderId} (₹1,000)`);

        // 6. Update Customer Balance
        const balanceIndex = customer.retailerBalances.findIndex(
            b => b.retailer.toString() === retailer._id.toString()
        );

        if (balanceIndex !== -1) {
            customer.retailerBalances[balanceIndex].balance += totalAmount;
        } else {
            customer.retailerBalances.push({
                retailer: retailer._id,
                balance: totalAmount
            });
        }
        await customer.save();

        console.log("-----------------------------------------");
        console.log("✅ DUE BALANCE ADDED SUCCESSFULLY");
        console.log(`Customer: ${customer.fullName} (${phoneNumber})`);
        console.log(`Added Due Amount: ₹${totalAmount}`);
        console.log(`Total Due Now: ₹${customer.retailerBalances.find(b => b.retailer.toString() === retailer._id.toString()).balance}`);
        console.log("-----------------------------------------");
        console.log("Refresh your Customer Directory to see the update!");

        await mongoose.disconnect();
    } catch (err) {
        console.error("Simulation failed:", err);
        process.exit(1);
    }
}

addDue();
