import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import { adjustBalance } from "../services/walletService.js";
import { emitOrderUpdate, emitShopStatusUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";
import { getCurrentCommissionRate } from "./commissionController.js";

// Get all approved shops (retailers)
export const getPublicShops = async (req, res) => {
    try {
        const { search = "" } = req.query;
        const query = { role: "retailer", status: "approved" };

        if (search) {
            query.$or = [
                { "businessDetails.businessName": { $regex: search, $options: "i" } },
                { "businessDetails.storeDisplayName": { $regex: search, $options: "i" } }
            ];
        }

        const shops = await User.find(query)
            .select("name email businessDetails isShopActive createdAt")
            .sort({ createdAt: -1 });

        const minimalShops = shops.map(shop => ({
            id: shop._id,
            name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
            businessName: shop.businessDetails?.businessName,
            image: shop.businessDetails?.storeImage || "",
            location: shop.businessDetails?.location?.city || "",
            isShopActive: shop.isShopActive ?? true,
            rating: 4.5, // Placeholder for future rating system
            deliveryTime: "30-45 mins" // Placeholder
        }));

        res.status(200).json({ success: true, data: minimalShops });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single shop details
export const getShopDetails = async (req, res) => {
    try {
        const shop = await User.findOne({ _id: req.params.id, role: "retailer", status: "approved" })
            .select("businessDetails name email isShopActive");

        if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

        res.status(200).json({
            success: true,
            data: {
                id: shop._id,
                name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
                businessName: shop.businessDetails?.businessName,
                image: shop.businessDetails?.storeImage || "",
                address: shop.businessDetails?.location,
                contact: shop.email,
                isShopActive: shop.isShopActive ?? true
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get products for a specific shop
export const getShopProducts = async (req, res) => {
    try {
        const products = await Product.find({ retailer: req.params.shopId, status: "Published" })
            .populate("category", "name").sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle Shop status
export const toggleShopStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).send("Retailer not found");
        user.isShopActive = !user.isShopActive;
        await user.save();
        await emitShopStatusUpdate(user._id, user.isShopActive);
        res.status(200).json({ success: true, isShopActive: user.isShopActive });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Finalize order weight
export const finalizeOrderWeight = async (req, res) => {
    try {
        const { orderId, itemId, actualWeight } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        const item = order.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: "Item not found" });

        const originalPrice = item.price * item.quantity;
        const actualPrice = item.price * (actualWeight / 1);
        const diff = originalPrice - actualPrice;

        item.deliveredWeight = actualWeight;
        await order.save();

        if (diff > 0) {
            await adjustBalance(order.user, "appUser", diff, "Credit", `Refund for weight variation ${orderId}`, "System Adjustment", orderId);
        }

        await emitOrderUpdate(orderId, "Weight Finalized", { orderId, itemId, actualWeight, actualPrice }, req.user.id);
        res.status(200).json({ success: true, diff, newPrice: actualPrice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Dashboard Stats
export const getRetailerDashboardStats = async (req, res) => {
    try {
        const retailerId = req.user.id;
        const orders = await Order.find({ "items.retailer": retailerId });
        let totalRevenue = 0;
        let totalOrders = orders.length;
        const customerIds = new Set();
        let newOrdersCount = 0;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        orders.forEach(order => {
            customerIds.add(order.user.toString());
            if (new Date(order.createdAt) >= yesterday) newOrdersCount++;
            order.items.forEach(item => {
                if (item.retailer.toString() === retailerId) {
                    totalRevenue += item.price * item.quantity;
                }
            });
        });

        const activeProducts = await Product.countDocuments({ retailer: retailerId, status: "Published" });
        const recentOrders = await Order.find({ "items.retailer": retailerId })
            .select("orderId user createdAt items status statusHistory").populate("user", "fullName")
            .sort({ createdAt: -1 }).limit(10);

        const recentActivities = [];
        recentOrders.forEach(o => {
            recentActivities.push({
                id: `new_${o._id}`, type: 'order_new', title: 'New Order Received',
                message: `Order #${o.orderId.slice(-6).toUpperCase()} from ${o.user?.fullName || 'Customer'}`,
                timestamp: o.createdAt, status: 'info'
            });
        });

        res.status(200).json({
            success: true,
            data: {
                stats: { totalRevenue, totalOrders, newOrders: newOrdersCount, activeProducts, totalCustomers: customerIds.size, isShopActive: (await User.findById(retailerId)).isShopActive },
                recentActivities: recentActivities.slice(0, 10)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

import Payout from "../models/Payout.js";

export const getRetailerRevenueStats = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const orders = await Order.find({ "items.retailer": retailerId });
        let totalGross = 0;
        let totalCommission = 0;
        orders.forEach(order => {
            let orderGross = 0;
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) orderGross += item.price * item.quantity;
            });
            if (orderGross === 0) return;
            const rate = order.commissionRate || 0;
            const commission = parseFloat(((orderGross * rate) / 100).toFixed(2));
            totalGross += orderGross;
            totalCommission += commission;
        });

        const totalNet = totalGross - totalCommission;
        const payouts = await Payout.find({ retailer: retailerId });
        let totalSettled = 0;
        payouts.forEach(p => { if (p.status === 'Approved') totalSettled += p.amount; });

        res.status(200).json({
            success: true,
            data: { availableBalance: (totalNet - totalSettled).toFixed(2), totalEarnings: totalNet.toFixed(2), totalSettled: totalSettled.toFixed(2) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerCustomers = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const orders = await Order.find({ "items.retailer": retailerId }).populate("user", "fullName email phoneNumber profilePicture");
        const customerMap = new Map();
        orders.forEach(o => {
            if (!o.user) return;
            const cId = o.user._id.toString();
            if (!customerMap.has(cId)) customerMap.set(cId, { user: o.user, orderCount: 1 });
            else customerMap.get(cId).orderCount++;
        });

        const customers = Array.from(customerMap.values()).map(({ user, orderCount }) => ({
            id: user._id, name: user.fullName || "Customer", phone: user.phoneNumber || "N/A", orderCount
        }));

        res.status(200).json({ success: true, data: { customers } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createManualOrder = async (req, res) => {
    try {
        const { customerId, items, paymentStatus = "Pending" } = req.body;
        const retailerId = req.user._id;
        const orderId = `ORD-MAN-${Date.now()}`;
        const order = await Order.create({
            orderId, user: customerId, items, totalAmount: req.body.totalAmount,
            paymentMethod: "Cash", paymentStatus, status: "Accepted", isManual: true,
            statusHistory: [{ status: "Accepted", changedBy: retailerId, role: 'retailer', timestamp: new Date() }]
        });
        await emitOrderUpdate(orderId, "Accepted", order, retailerId, customerId);
        res.status(201).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const query = { "items.retailer": retailerId };
        if (customerId) query.user = customerId;

        // Get total count for pagination
        const totalItemsCount = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalItemsCount / parseInt(limit));

        const orders = await Order.find(query)
            .populate("items.product", "name")
            .populate("rider", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get overall stats (including non-paginated status counts)
        const allOrdersForStats = await Order.find(query).select("status totalAmount items");
        let pendingOrders = 0;
        let completedOrders = 0;
        let totalRevenue = 0;

        allOrdersForStats.forEach(order => {
            let retailerOrderTotal = 0;
            const retailerItems = order.items.filter(item => item.retailer && item.retailer.toString() === retailerId.toString());
            retailerItems.forEach(item => {
                retailerOrderTotal += (item.price || 0) * (item.quantity || 0);
            });
            totalRevenue += retailerOrderTotal;
            
            const status = order.status;
            if (['Pending', 'Accepted', 'Processing', 'Preparing', 'Shipped', 'Out for Delivery', 'Rider Assigned', 'Rider Accepted'].includes(status)) {
                pendingOrders++;
            } else if (status === 'Delivered' || status === 'Completed') {
                completedOrders++;
            }
        });

        const formattedOrders = orders.map(order => {
            let retailerOrderTotal = 0;
            let productNames = [];
            const retailerItems = order.items.filter(item => item.retailer && item.retailer.toString() === retailerId.toString());

            retailerItems.forEach(item => {
                retailerOrderTotal += (item.price || 0) * (item.quantity || 0);
                productNames.push(`${item.quantity}x ${item.product?.name || 'Unknown'}`);
            });

            const status = order.status;

            return {
                id: order.orderId || `#${order._id.toString().slice(-6).toUpperCase()}`,
                product: productNames.join(", "),
                date: new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).replace(/\//g, "-"),
                price: retailerOrderTotal.toFixed(2),
                payment: order.paymentStatus,
                status: status,
                orderType: order.orderType || (order.orderId?.startsWith("SUB-") ? "Subscription" : "One-time"),
                rider: order.rider ? {
                    id: order.rider._id,
                    name: order.rider.name || "Delivery Partner"
                } : null,
                statusHistory: order.statusHistory || []
            };
        });

        res.status(200).json({
            success: true,
            data: {
                orders: formattedOrders,
                pagination: {
                    totalOrders: totalItemsCount,
                    totalPages,
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                },
                stats: {
                    totalOrders: totalItemsCount,
                    pendingOrders,
                    completedOrders,
                    totalRevenue: totalRevenue.toFixed(2),
                    avgOrderValue: totalItemsCount > 0 ? (totalRevenue / totalItemsCount).toFixed(2) : "0"
                }
            }
        });
    } catch (error) {
        console.error("❌ getRetailerOrders Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateOrderItemStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const retailerId = req.user._id;
        const order = await Order.findOne({ orderId }).populate('user', '_id');
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.status === status) return res.status(400).json({ success: false, message: `Status already '${status}'` });

        order.status = status;
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push({ status, changedBy: retailerId, role: 'retailer', timestamp: new Date() });
        await order.save();
        await emitOrderUpdate(orderId, status, { orderId, status, statusHistory: order.statusHistory }, retailerId, order.user?._id);
        res.status(200).json({ success: true, message: "Updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const assignRiderToOrder = async (req, res) => {
    try {
        const { orderId, riderId } = req.body;
        const retailerId = req.user._id;
        const order = await Order.findOne({ orderId, "items.retailer": retailerId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        order.rider = riderId;
        order.status = "Rider Assigned";
        order.statusHistory.push({ status: "Rider Assigned", changedBy: retailerId, role: 'retailer', timestamp: new Date() });
        await order.save();
        await emitOrderUpdate(orderId, "Rider Assigned", { orderId, riderId, statusHistory: order.statusHistory }, retailerId);
        res.status(200).json({ success: true, message: "Rider assigned" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

import Review from "../models/Review.js";
export const getRetailerReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ retailer: req.user._id }).populate("user", "fullName").populate("product", "name").sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { reviews } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getDueOrdersForCustomer = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.params.customerId, "items.retailer": req.user._id, paymentStatus: "Due" });
        res.status(200).json({ success: true, data: { orders } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addManualCustomer = async (req, res) => {
    try {
        const user = await AppUser.create({ ...req.body, addedByRetailer: req.user._id, isManual: true });
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const settleCustomerDue = async (req, res) => {
    try {
        res.status(200).json({ success: true, message: "Settled" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createManualSubscription = async (req, res) => {
    try {
        const sub = await Subscription.create({ ...req.body, retailer: req.user._id, isManual: true });
        res.status(201).json({ success: true, data: sub });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerSubscriptions = async (req, res) => {
    try {
        const subs = await Subscription.find({ retailer: req.user._id }).populate('user', 'fullName').populate('product', 'name');
        res.status(200).json({ success: true, data: subs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
