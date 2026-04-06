import mongoose from 'mongoose';
import 'dotenv/config';
import Order from '../models/Order.js';

const MONGO_URI = process.env.MONGO_URI;

async function createPendingOrder() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to DB");

        const orderId = `VND-AUTO-${Date.now()}`;
        const order = await Order.create({
            orderId,
            user: "69c51154c0f1bf420044dd14",
            items: [{
                product: "69c13a85bc9d4cd3b3ea0790",
                retailer: "69b7f7eb2afe5af2829d84a9",
                quantity: 1,
                price: 20,
                status: "Pending"
            }],
            totalAmount: 20,
            status: "Pending",
            paymentMethod: "Cash",
            paymentStatus: "Pending",
            statusHistory: [{
                status: "Pending",
                role: "user",
                timestamp: new Date()
            }],
            deliveryAddress: {
               address: "Test Address",
               city: "Test City"
            }
        });

        console.log(`SUCCESS: Created Pending Order ${order.orderId} for current Retailer`);
        process.exit(0);
    } catch (err) {
        console.error("Error creating order:", err);
        process.exit(1);
    }
}

createPendingOrder();
