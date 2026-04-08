import Order from "../models/Order.js";
import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";

export const getDailyPrepList = async (retailerId, dateString) => {
    const date = new Date(dateString || new Date());
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    // Fetch subscription orders for today (Scheduled only)
    const subscriptionOrders = await Order.find({
        "items.retailer": retailerId,
        orderType: "Subscription",
        createdAt: { $gte: date, $lt: nextDay },
        status: { $nin: ["Cancelled"] }
    }).populate("items.product").populate("user", "fullName phoneNumber alternateContact");

    const summary = {};
    const detailed = [];
    const paused = [];

    // Process all subscription orders
    subscriptionOrders.forEach(order => {
        // Flatten items: each product gets its own row as requested
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                const prod = item.product;
                if (!prod) return;

                const row = {
                    id: `${order._id}_${prod._id}`,
                    orderId: order.orderId,
                    customerName: order.user?.fullName || "Guest Customer",
                    phoneNumber: order.user?.phoneNumber || "N/A",
                    productName: prod.name,
                    category: prod.category || "General",
                    quantity: item.quantity,
                    price: item.price,
                    deliverySlot: order.deliverySlot || "Standard",
                    status: order.status,
                    isPaused: order.status === "Paused" || order.status === "Vacation" || (order.pauseMetrics && order.pauseMetrics.isPaused)
                };

                if (row.isPaused) {
                    paused.push(row);
                } else {
                    detailed.push(row);
                }

                // Keep summary logic for total packing counts
                const prodId = prod._id.toString();
                if (!summary[prodId]) {
                    summary[prodId] = {
                        id: prodId,
                        productName: prod.name,
                        category: prod.category || "General",
                        quantity: 0,
                        orderCount: 0,
                        totalRevenue: 0,
                        status: "Pending"
                    };
                }
                if (!row.isPaused) {
                    summary[prodId].quantity += item.quantity;
                    summary[prodId].orderCount += 1;
                    summary[prodId].totalRevenue += (item.price || 0) * item.quantity;
                }
            }
        });
    });

    return {
        summary: Object.values(summary),
        active: detailed,
        paused: paused
    };
};
