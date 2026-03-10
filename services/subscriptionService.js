import Subscription from "../models/Subscription.js";
import Order from "../models/Order.js";
import { emitOrderUpdate } from "./socketService.js";
import Product from "../models/Product.js";
import { adjustBalance } from "./walletService.js";
import mongoose from "mongoose";

export const createSubscription = async (userId, subscriptionData) => {
    // Basic validation: Check if product exists and user has min balance
    const product = await Product.findById(subscriptionData.product);
    if (!product) throw new Error("Product not found");

    const subscription = await Subscription.create({
        user: userId,
        ...subscriptionData,
        retailer: product.retailer
    });

    return subscription;
};

export const generateDailyOrders = async (targetDate = new Date()) => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[targetDate.getDay()];

    // 1. Find active subscriptions
    const subscriptions = await Subscription.find({ status: "Active" }).populate("product");

    const stats = { created: 0, failed: 0, skipped: 0 };

    for (const sub of subscriptions) {
        if (sub.status === "Paused") {
            stats.skipped++;
            continue;
        }

        try {
            let shouldDeliver = false;
            if (sub.frequency === "Daily") {
                shouldDeliver = true;
            } else if (sub.frequency === "Alternate Days") {
                const diffTime = Math.abs(targetDate - sub.startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays % 2 === 0) shouldDeliver = true;
            } else if (sub.frequency === "Weekly") {
                if (sub.customDays && sub.customDays.includes(currentDayName)) {
                    shouldDeliver = true;
                }
            }

            const isOnVacation = sub.vacationDates.some(vDate =>
                vDate.toDateString() === targetDate.toDateString()
            );

            if (!shouldDeliver || isOnVacation) {
                stats.skipped++;
                continue;
            }

            // Check if subscription has started yet
            const subStart = new Date(sub.startDate);
            subStart.setHours(0, 0, 0, 0);
            const targetDay = new Date(targetDate);
            targetDay.setHours(0, 0, 0, 0);
            if (targetDay < subStart) {
                stats.skipped++;
                continue;
            }

            const product = sub.product;
            const dayStart = new Date(targetDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(targetDate);
            dayEnd.setHours(23, 59, 59, 999);

            const todayOrdersCount = await Order.countDocuments({
                "items.product": product._id,
                subscriptionId: sub._id,
                createdAt: { $gte: dayStart, $lt: dayEnd }
            });

            if (todayOrdersCount > 0) {
                // Already generated for today
                stats.skipped++;
                continue;
            }

            if (product.dailyCapacity && todayOrdersCount >= product.dailyCapacity) {
                console.log(`Capacity reached for ${product.name}. Skipping subscription ${sub._id}`);
                stats.skipped++;
                continue;
            }

            // 5. Create Order & Debit Wallet
            const amount = sub.product.price * sub.quantity;

            // Atomically debit wallet and create order
            await adjustBalance(
                sub.user,
                "appUser",
                amount,
                "Debit",
                `Subscription Delivery: ${sub.product.name}`,
                "Wallet",
                sub._id
            );

            const orderId = `SUB-${Date.now()}-${sub._id.toString().slice(-4)}`;
            const newOrder = await Order.create({
                orderId,
                user: sub.user,
                items: [{
                    product: sub.product._id,
                    retailer: sub.retailer,
                    quantity: sub.quantity,
                    price: sub.product.price,
                    status: "Accepted" // Subscriptions are pre-accepted by the system
                }],
                totalAmount: amount,
                orderType: "Subscription",
                subscriptionId: sub._id,
                paymentStatus: "Paid",
                paymentMethod: "Wallet"
            });

            sub.lastGeneratedDate = targetDate;

            // 6. Referral Reward Check (e.g., after 7 successful orders)
            const subOrderCount = await Order.countDocuments({ subscriptionId: sub._id, paymentStatus: "Paid" });
            if (subOrderCount === 7) {
                import("./referralService.js").then(module => module.rewardReferral(sub.user));
            }

            // 7. Loyalty Points
            import("./loyaltyService.js").then(module => module.awardLoyaltyPoints(sub.user, amount));

            await sub.save();

            // 8. Socket Notification
            if (newOrder && newOrder.items && newOrder.items.length > 0) {
                emitOrderUpdate(newOrder.orderId, "Accepted", newOrder, newOrder.items[0].retailer);
            }

            stats.created++;

        } catch (error) {
            console.error(`Failed to generate order for subscription ${sub._id}:`, error.message);
            stats.failed++;
        }
    }

    return stats;
};
