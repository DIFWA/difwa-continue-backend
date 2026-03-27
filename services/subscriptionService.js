import Subscription from "../models/Subscription.js";
import Order from "../models/Order.js";
import { emitOrderUpdate } from "./socketService.js";
import Product from "../models/Product.js";
import { adjustBalance } from "./walletService.js";
import mongoose from "mongoose";
import AppUser from "../models/AppUser.js";

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

    const stats = { created: 0, failed: 0, skipped: 0, errors: [] };

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
                // Case-insensitive check for day names
                if (sub.customDays && sub.customDays.some(d => d.toLowerCase() === currentDayName.toLowerCase())) {
                    shouldDeliver = true;
                }
            }

            const isOnVacation = sub.vacationDates.some(vDate =>
                vDate.toDateString() === targetDate.toDateString()
            );

            if (!shouldDeliver) {
                console.log(`[SKIP] Frequency/Day Mismatch: Sub ${sub._id} (Freq: ${sub.frequency}, Days: ${sub.customDays}, Today: ${currentDayName})`);
                stats.skipped++;
                continue;
            }

            if (isOnVacation) {
                console.log(`[SKIP] User on Vacation: Sub ${sub._id}`);
                stats.skipped++;
                continue;
            }

            // Check if subscription has started yet
            const subStart = new Date(sub.startDate);
            subStart.setHours(0, 0, 0, 0);
            const targetDay = new Date(targetDate);
            targetDay.setHours(0, 0, 0, 0);

            // If start date is in the future (beyond today), skip
            if (targetDay < subStart) {
                console.log(`[SKIP] Future Start: Sub ${sub._id} (Starts: ${subStart.toDateString()}, Today: ${targetDay.toDateString()})`);
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
                console.log(`[SKIP] Already Generated Today: Sub ${sub._id}`);
                stats.skipped++;
                continue;
            }

            // 5. Handle Payment & Create Order
            const amount = sub.product.price * sub.quantity;
            let paymentStatus = "Paid";
            let paymentMethod = "Wallet";

            if (sub.isManual) {
                // For manual subscriptions, update the customer's due balance with this retailer
                const customer = await AppUser.findById(sub.user);
                if (!customer) {
                    console.log(`[SKIP] Missing User for Manual Sub: ${sub._id}`);
                    stats.skipped++;
                    continue;
                }

                const balanceIndex = customer.retailerBalances.findIndex(
                    b => b.retailer.toString() === sub.retailer.toString()
                );

                if (balanceIndex !== -1) {
                    customer.retailerBalances[balanceIndex].balance += amount;
                } else {
                    customer.retailerBalances.push({
                        retailer: sub.retailer,
                        balance: amount
                    });
                }
                await customer.save();
                
                paymentStatus = "Due";
                paymentMethod = "Cash";
            } else {
                // Atomically debit wallet for standard subscriptions
                try {
                    await adjustBalance(
                        sub.user,
                        "appUser",
                        amount,
                        "Debit",
                        `Subscription Delivery: ${sub.product.name}`,
                        "Wallet",
                        sub._id
                    );
                } catch (balanceError) {
                    if (balanceError.message === "User not found") {
                        console.log(`[SKIP] Missing User for Standard Sub: ${sub._id}`);
                        stats.skipped++;
                        continue;
                    }
                    throw balanceError; // Re-throw other errors (like Insufficient Balance)
                }
            }

            const orderId = `SUB-${Date.now()}-${sub._id.toString().slice(-4)}`;
            const newOrder = await Order.create({
                orderId,
                user: sub.user,
                items: [{
                    product: sub.product._id,
                    retailer: sub.retailer,
                    quantity: sub.quantity,
                    price: sub.product.price,
                    status: "Accepted"
                }],
                totalAmount: amount,
                orderType: "Subscription",
                subscriptionId: sub._id,
                paymentStatus,
                paymentMethod,
                isManual: sub.isManual || false,
                deliveryAddress: sub.deliveryAddress ? { address: sub.deliveryAddress } : undefined
            });

            sub.lastGeneratedDate = targetDate;

            // 6. Referral & Loyalty (Only for paid standard subscriptions)
            if (paymentStatus === "Paid") {
                const subOrderCount = await Order.countDocuments({ subscriptionId: sub._id, paymentStatus: "Paid" });
                if (subOrderCount === 7) {
                    import("./referralService.js").then(module => module.rewardReferral(sub.user));
                }
                import("./loyaltyService.js").then(module => module.awardLoyaltyPoints(sub.user, amount));
            }

            await sub.save();

            // 8. Socket Notification
            if (newOrder && newOrder.items && newOrder.items.length > 0) {
                const emitData = {
                    ...newOrder.toObject(),
                    product: `${sub.quantity}x ${sub.product.name}`,
                    subscriptionDetails: {
                        frequency: sub.frequency,
                        customDays: sub.customDays
                    },
                    createdAt: newOrder.createdAt
                };
                await emitOrderUpdate(newOrder.orderId, "Accepted", emitData, newOrder.items[0].retailer, sub.user);
            }

            stats.created++;

        } catch (error) {
            console.error(`[CRON ERROR] Sub ${sub._id}:`, error.message);
            stats.failed++;
        }
    }

    return stats;
};
