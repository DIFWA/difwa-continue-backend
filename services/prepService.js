import Order from "../models/Order.js";
import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";

export const getDailyPrepList = async (retailerId, dateString) => {
    const date = new Date(dateString || new Date());
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    // 1. Find all active subscriptions for this retailer
    // Note: This matches the daily order generation logic
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    // Find subscriptions that should deliver on this day
    const activeSubscriptions = await Subscription.find({
        retailer: retailerId,
        status: 'Active',
        deliveryDays: dayOfWeek,
        startDate: { $lte: date },
        $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: date } }
        ]
    }).populate('product');

    // 2. Find one-time orders for this retailer on this day
    const oneTimeOrders = await Order.find({
        retailer: retailerId,
        orderType: 'One-time',
        deliveryDate: { $gte: date, $lt: nextDay },
        status: { $nin: ['Cancelled', 'Delivered'] }
    }).populate('items.product');

    // 3. Aggregate requirements
    const requirements = {};

    activeSubscriptions.forEach(sub => {
        const prodId = sub.product._id.toString();
        if (!requirements[prodId]) {
            requirements[prodId] = {
                productName: sub.product.name,
                category: sub.product.category,
                quantity: 0,
                unit: sub.product.unit || 'kg',
                orderCount: 0
            };
        }
        requirements[prodId].quantity += sub.quantity;
        requirements[prodId].orderCount += 1;
    });

    oneTimeOrders.forEach(order => {
        order.items.forEach(item => {
            const prodId = item.product._id.toString();
            if (!requirements[prodId]) {
                requirements[prodId] = {
                    productName: item.product.name,
                    category: item.product.category,
                    quantity: 0,
                    unit: item.product.unit || 'kg',
                    orderCount: 0
                };
            }
            requirements[prodId].quantity += item.quantity;
            requirements[prodId].orderCount += 1;
        });
    });

    return Object.values(requirements);
};
