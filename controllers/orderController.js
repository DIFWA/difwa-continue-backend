import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppUser from "../models/AppUser.js";
import * as walletService from "../services/walletService.js";

export const placeOrder = async (req, res) => {
    try {
        const userId = req.userId;
        const { deliveryAddress, paymentMethod } = req.body;

        // 1. Fetch Cart
        const cart = await Cart.findOne({ user: userId }).populate("items.product");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        // 2. Validate Stock and Calculate Total
        let totalAmount = 0;
        const orderItems = [];

        for (const item of cart.items) {
            if (item.product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for ${item.product.name}. Available: ${item.product.stock}kg`
                });
            }

            totalAmount += item.price * item.quantity;
            orderItems.push({
                product: item.product._id,
                retailer: cart.retailer,
                quantity: item.quantity,
                price: item.price,
                status: "Pending"
            });
        }

        // 2.1 Wallet Balance Check
        if (paymentMethod === "Wallet") {
            const user = await AppUser.findById(userId);
            if (!user || user.walletBalance < totalAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. Total: ₹${totalAmount}, Current: ₹${user?.walletBalance || 0}`
                });
            }

            // Deduct from wallet
            await walletService.adjustBalance(userId, "appUser", totalAmount, "Debit", "Order Payment", "Order", null);
        }

        // 3. Generate Order ID
        const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 4. Create Order
        const order = await Order.create({
            orderId,
            user: userId,
            items: orderItems,
            totalAmount,
            deliveryAddress,
            paymentMethod,
            paymentStatus: paymentMethod === "Wallet" ? "Paid" : "Pending",
            orderType: "One-time"
        });

        // 5. Update Stock
        for (const item of cart.items) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { stock: -item.quantity }
            });
        }

        // 6. Clear Cart
        await Cart.findOneAndDelete({ user: userId });

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.userId })
            .populate("items.product")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
