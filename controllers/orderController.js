import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import * as walletService from "../services/walletService.js";
import { emitOrderUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";

export const placeOrder = async (req, res) => {
    try {
        const userId = req.userId;
        let { deliveryAddress, paymentMethod, orderType } = req.body;

        // 1. Fetch Cart
        const cart = await Cart.findOne({ user: userId }).populate("items.product");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        // 1.1 Address handling (for Spot Orders where address might not be sent)
        if (!deliveryAddress || Object.keys(deliveryAddress).length === 0) {
            const user = await AppUser.findById(userId);
            const defaultAddress = user?.addresses?.find(a => a.isDefault);
            if (defaultAddress) {
                deliveryAddress = {
                    address: defaultAddress.fullAddress,
                    city: defaultAddress.city,
                    state: defaultAddress.state,
                    pincode: defaultAddress.pincode
                };
            }
        }

        // 2. Validate Stock and Calculate Total
        let totalAmount = 0;
        const orderItems = [];

        for (const item of cart.items) {
            const currentPrice = item.product.price; // Always use latest price from populated product
            if (item.product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for ${item.product.name}. Available: ${item.product.stock}kg`
                });
            }

            totalAmount += currentPrice * item.quantity;
            orderItems.push({
                product: item.product._id,
                retailer: cart.retailer,
                quantity: item.quantity,
                price: currentPrice,
                status: "Pending"
            });
        }

        // 2.1 Wallet Balance Check
        if (paymentMethod === "Wallet") {
            const user = await AppUser.findById(userId);
            if (!user || user.walletBalance < totalAmount) {
                const cartSummary = cart.items.map(i => `${i.quantity}x ${i.product.name} (@₹${i.product.price})`).join(", ");
                console.log(`[PAYMENT_FAILED] User ${userId} insufficient balance. Total: ₹${totalAmount}, Balance: ₹${user?.walletBalance}, Items: ${cartSummary}`);

                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. Total: ₹${totalAmount}, Current: ₹${user?.walletBalance || 0}. (Items: ${cart.items.length})`
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
            orderType: orderType || "One-time"
        });

        // 5. Update Stock & Check for Low Inventory
        for (const item of cart.items) {
            const updatedProduct = await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { stock: -item.quantity } },
                { new: true }
            );

            if (updatedProduct.stock <= 5) {
                createNotification(cart.retailer.toString(), {
                    title: "Low Inventory Alert! ⚠️",
                    message: `Product "${updatedProduct.name}" is running low on stock (${updatedProduct.stock}kg left).`,
                    type: "Inventory",
                    referenceId: updatedProduct._id.toString()
                });
            }
        }

        // 6. Clear Cart
        await Cart.findOneAndDelete({ user: userId });

        // 7. Socket Notification
        emitOrderUpdate(order.orderId, "Pending", order, cart.retailer, userId);

        // Create Notification for Retailer
        createNotification(cart.retailer.toString(), {
            title: "New Order Received! 🦐",
            message: `You have a new order (#${order._id.toString().slice(-6)}) for ₹${totalAmount}.`,
            type: "Order",
            referenceId: order._id.toString()
        });

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
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const placeSpotOrder = async (req, res) => {
    // Spot orders are just one-time orders placed manually. 
    // We can reuse the placeOrder logic but maybe with a flag or specific tagging.
    // For now, let's just implement a dedicated endpoint if needed, 
    // but placeOrder already handles one-time orders.
    // However, the user wants a specific "Order for Today" button.
    return placeOrder(req, res);
};

export const getUserOrderHistory = async (req, res) => {
    try {
        const userId = req.userId;

        // 1. Fetch Past Orders
        const orders = await Order.find({ user: userId })
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .sort({ createdAt: -1 });

        // 2. Fetch Active Plans (Subscriptions) - Including paused for history visibility
        const subscriptions = await Subscription.find({ user: userId })
            .populate("product")
            .populate("retailer", "businessDetails")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                orders: orders,
                activePlans: subscriptions
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
