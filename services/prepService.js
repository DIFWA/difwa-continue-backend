import Order from "../models/Order.js";
import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";

export const getDailyPrepList = async (retailerId, dateString) => {
    const date = new Date(dateString || new Date());
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    // Fetch subscription orders already created for today
    const subscriptionOrders = await Order.find({
        "items.retailer": retailerId,
        orderType: "Subscription",
        createdAt: { $gte: date, $lt: nextDay },
        status: { $nin: ["Cancelled", "Delivered"] }
    }).populate("items.product");

    // Also include active one-time orders for today
    const oneTimeOrders = await Order.find({
        "items.retailer": retailerId,
        orderType: "One-time",
        createdAt: { $gte: date, $lt: nextDay },
        status: { $nin: ["Cancelled", "Delivered"] }
    }).populate("items.product");

    const requirements = {};

    const addItemToRequirements = (item, type) => {
        if (!item.product) return;
        const prodId = item.product._id.toString();
        if (!requirements[prodId]) {
            requirements[prodId] = {
                id: prodId,
                productName: item.product.name,
                category: item.product.category || "Uncategorized",
                quantity: 0,
                unit: item.product.unit || "kg",
                orderCount: 0,
                subscriptionCount: 0,
                oneTimeCount: 0,
                status: "Pending"
            };
        }
        requirements[prodId].quantity += item.quantity;
        requirements[prodId].orderCount += 1;
        if (type === "Subscription") requirements[prodId].subscriptionCount += 1;
        else requirements[prodId].oneTimeCount += 1;
    };

    subscriptionOrders.forEach(order => {
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                addItemToRequirements(item, "Subscription");
            }
        });
    });

    oneTimeOrders.forEach(order => {
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                addItemToRequirements(item, "One-time");
            }
        });
    });

    return Object.values(requirements);
};
