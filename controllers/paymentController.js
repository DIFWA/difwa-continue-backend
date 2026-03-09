// after cart is done
import { createRazorpayOrder } from "../services/razorpayService.js";

export const createOrder = async (req, res) => {
    try {

        const { amount } = req.body;

        const order = await createRazorpayOrder(amount);

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};