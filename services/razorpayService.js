import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (amount, currency = "INR") => {
    try {
        const options = {
            amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
            currency,
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        throw error;
    }
};

export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    const text = orderId + "|" + paymentId;
    const generated_signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest("hex");

    return generated_signature === signature;
};