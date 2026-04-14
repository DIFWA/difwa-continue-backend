import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import { adjustBalance } from "../services/walletService.js";
import { emitOrderUpdate, emitShopStatusUpdate } from "../services/socketService.js";
import { createNotification, notifyAdmins } from "../services/notificationService.js";
import { getCurrentCommissionRate } from "./commissionController.js";
import { checkAndNotifyLowStock } from "../services/stockService.js";

// Get all approved shops (retailers)
export const getPublicShops = async (req, res) => {
    try {
        const { search = "" } = req.query;

        // 1. Get unique IDs of retailers who have at least one "Published" product
        const retailersWithProducts = await Product.distinct("retailer", { status: "Published" });

        const query = { 
            _id: { $in: retailersWithProducts },
            role: "retailer", 
            status: "approved" 
        };

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
            deliveryTime: "30-45 mins", // Placeholder
            deliverySlots: shop.businessDetails?.deliverySlots || []
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
                isShopActive: shop.isShopActive ?? true,
                deliverySlots: shop.businessDetails?.deliverySlots || []
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

        // Generate Chart Data (Last 7 Days)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-IN', { weekday: 'short' });
            
            // Calculate sales for this retailer on this day
            let dailySales = 0;
            orders.forEach(order => {
                const orderDate = new Date(order.createdAt);
                if (orderDate.toDateString() === date.toDateString()) {
                    order.items.forEach(item => {
                        if (item.retailer.toString() === retailerId) {
                            dailySales += (item.price || 0) * (item.quantity || 0);
                        }
                    });
                }
            });

            chartData.push({ name: dateStr, sales: dailySales });
        }

        res.status(200).json({
            success: true,
            data: {
                stats: { 
                    totalRevenue, 
                    totalOrders, 
                    newOrders: newOrdersCount, 
                    activeProducts, 
                    totalCustomers: customerIds.size, 
                    isShopActive: (await User.findById(retailerId)).isShopActive 
                },
                recentActivities: recentActivities.slice(0, 10),
                chartData
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
        const { range, startDate, endDate } = req.query;

        // Base query for orders: must belong to retailer and be finalized
        const baseQuery = { 
            "items.retailer": retailerId,
            status: { $in: ["Delivered", "Completed"] } 
        };

        // Time Filter logic
        let dateFilter = {};
        const now = new Date();
        
        if (range === 'today') {
            const start = new Date(now.setHours(0, 0, 0, 0));
            dateFilter = { createdAt: { $gte: start } };
        } else if (range === 'yesterday') {
            const start = new Date(now.setDate(now.getDate() - 1));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            dateFilter = { createdAt: { $gte: start, $lte: end } };
        } else if (range === 'week') {
            const start = new Date(now.setDate(now.getDate() - 7));
            dateFilter = { createdAt: { $gte: start } };
        } else if (range === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { createdAt: { $gte: start } };
        } else if (range === 'custom' && startDate && endDate) {
            dateFilter = { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
        }

        // Apply date filter to specifically range-based stats
        const filteredQuery = { ...baseQuery, ...dateFilter };

        // 1. Fetch Lifetime Orders (for Available Balance & Lifetime Gross)
        const lifetimeOrders = await Order.find(baseQuery);
        
        // 2. Fetch Filtered Orders (for "Estimated Earnings" of the current range)
        const rangeOrders = await Order.find(filteredQuery);

        // Helper to sum gross and commission from a list of orders
        const calculateStats = (orderList) => {
            let gross = 0;
            let commission = 0;
            orderList.forEach(order => {
                let orderGross = 0;
                order.items.forEach(item => {
                    if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                        orderGross += item.price * item.quantity;
                    }
                });
                if (orderGross > 0) {
                    const rate = order.commissionRate || 0;
                    const comm = parseFloat(((orderGross * rate) / 100).toFixed(2));
                    gross += orderGross;
                    commission += comm;
                }
            });
            return { gross, commission, net: gross - commission };
        };

        const lifetime = calculateStats(lifetimeOrders);
        const currentRangeStats = calculateStats(rangeOrders);

        // 3. Payouts Logic
        const payouts = await Payout.find({ retailer: retailerId });
        let totalSettled = 0;
        payouts.forEach(p => { if (p.status === 'Approved') totalSettled += p.amount; });

        // 4. Get Current Active Commission Rate (for display)
        const activeRate = await getCurrentCommissionRate();

        res.status(200).json({
            success: true,
            data: { 
                availableBalance: Math.max(0, lifetime.net - totalSettled).toFixed(2), 
                estimatedEarnings: Math.max(0, currentRangeStats.net).toFixed(2), // This reflects the net for the selected range
                totalSettled: totalSettled.toFixed(2),
                totalEarnings: lifetime.net.toFixed(2), // Net Lifetime
                totalGrossEarnings: lifetime.gross.toFixed(2),
                totalCommissionDeducted: lifetime.commission.toFixed(2),
                commissionRate: activeRate
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerCustomers = async (req, res) => {
    try {
        const retailerId = req.user._id;
        
        // Fetch all orders for this retailer to build customer history
        const orders = await Order.find({ "items.retailer": retailerId })
            .populate("user", "fullName email phoneNumber profilePicture createdAt")
            .sort({ createdAt: 1 });

        const customerMap = new Map();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        let newCustomersCount = 0;
        let repeatCustomersCount = 0;

        orders.forEach(o => {
            if (!o.user) return;
            const cId = o.user._id.toString();
            
            if (!customerMap.has(cId)) {
                // Determine if this is a new customer (joined in last 7 days)
                const isNew = new Date(o.user.createdAt) >= sevenDaysAgo;
                if (isNew) newCustomersCount++;
                
                customerMap.set(cId, { 
                    user: o.user, 
                    orderCount: 1,
                    totalSpend: o.totalAmount || 0,
                    dueBalance: o.paymentStatus === 'Due' ? (o.totalAmount || 0) : 0,
                    lastOrderDate: o.createdAt,
                    orders: [o]
                });
            } else {
                const entry = customerMap.get(cId);
                if (entry.orderCount === 1) repeatCustomersCount++;
                entry.orderCount++;
                entry.totalSpend += o.totalAmount || 0;
                if (o.paymentStatus === 'Due') entry.dueBalance += (o.totalAmount || 0);
                entry.lastOrderDate = o.createdAt;
                entry.orders.push(o);
            }
        });

        // Also fetch any manual customers added by this retailer directly
        const manualCustomers = await AppUser.find({ addedByRetailer: retailerId, isManual: true });
        
        manualCustomers.forEach(user => {
            const cId = user._id.toString();
            if (!customerMap.has(cId)) {
                // Customer has no orders yet, but exists
                customerMap.set(cId, {
                    user: user,
                    orderCount: 0,
                    totalSpend: 0,
                    dueBalance: 0,
                    lastOrderDate: null,
                    orders: []
                });
            }
        });

        const customers = Array.from(customerMap.values()).map(({ user, orderCount, totalSpend, dueBalance, lastOrderDate, orders }) => ({
            id: user._id,
            name: user.fullName || "Customer",
            email: user.email || "N/A",
            phone: user.phoneNumber || "N/A",
            image: user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'C')}&background=random`,
            orderCount,
            spend: totalSpend.toFixed(2),
            balance: dueBalance.toFixed(2),
            status: orderCount > 5 ? "VIP" : (new Date(user.createdAt) >= sevenDaysAgo ? "New" : "Active"),
            lastOrder: lastOrderDate,
            orderIds: orders.map(o => o.orderId).reverse()
        }));

        // Generate Chart Data (Last 7 Days)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-IN', { weekday: 'short' });
            
            // Count unique customers who placed an order on this day
            const uniquePurchasers = new Set();
            orders.forEach(order => {
                if (new Date(order.createdAt).toDateString() === date.toDateString()) {
                    uniquePurchasers.add(order.user._id.toString());
                }
            });

            chartData.push({ name: dateStr, customers: uniquePurchasers.size });
        }

        const totalCustomers = customerMap.size;
        const repeatPercentage = totalCustomers > 0 
            ? `${Math.round((repeatCustomersCount / totalCustomers) * 100)}%` 
            : "0%";

        res.status(200).json({ 
            success: true, 
            data: { 
                customers,
                stats: {
                    totalCustomers,
                    newCustomers: newCustomersCount,
                    repeatPercentage
                },
                chartData
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createManualOrder = async (req, res) => {
    try {
        const { customerId, items, paymentStatus = "Pending", totalAmount: providedTotal, paymentMethod = "Cash", deliveryAddress, deliverySlot } = req.body;
        const retailerId = req.user._id;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }

        // Fetch products to verify existence and get current prices
        const productIds = items.map(i => i.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        
        let calculatedTotal = 0;
        const mappedItems = items.map(item => {
            const product = products.find(p => p._id.toString() === item.productId);
            if (!product) throw new Error(`Product with ID ${item.productId} not found`);
            
            const itemPrice = product.price;
            const itemTotal = itemPrice * item.quantity;
            calculatedTotal += itemTotal;

            return {
                product: product._id,
                retailer: retailerId,
                quantity: item.quantity,
                price: itemPrice,
                status: "Accepted"
            };
        });

        const orderId = `ORD-MAN-${Date.now()}`;
        const order = await Order.create({
            orderId,
            user: customerId,
            items: mappedItems,
            totalAmount: providedTotal || calculatedTotal,
            paymentMethod,
            paymentStatus,
            status: "Accepted",
            isManual: true,
            deliverySlot: deliverySlot || "Standard",
            deliveryAddress: typeof deliveryAddress === 'string' ? { address: deliveryAddress } : deliveryAddress,
            statusHistory: [{ 
                status: "Accepted", 
                changedBy: retailerId, 
                role: 'retailer', 
                timestamp: new Date() 
            }]
        });

        await emitOrderUpdate(orderId, "Accepted", order, retailerId, customerId);
        
        createNotification(retailerId.toString(), {
            title: "Manual Order Created! 💧",
            message: `Manual order #${orderId.slice(-6)} for ₹${order.totalAmount} has been recorded.`,
            type: "Order",
            referenceId: order._id.toString()
        });

        // ─── ADMIN GLOBAL NOTIFICATION ──────────────────
        notifyAdmins({
            title: "Global Manual Order 📝",
            message: `Manual order #${orderId.slice(-6)} recorded for ₹${order.totalAmount}.`,
            type: "Order",
            referenceId: order._id.toString()
        });

        // Update Stock and trigger alert if low
        for (const item of mappedItems) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
            checkAndNotifyLowStock(item.product).catch(err => console.error("Low stock check failed", err));
        }

        res.status(201).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId, statusFilter, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const query = { "items.retailer": retailerId };
        if (customerId) query.user = customerId;
        
        if (statusFilter === "Pending") {
            query.status = { $in: ['Pending', 'Accepted', 'Processing', 'Preparing', 'Shipped', 'Out for Delivery', 'Rider Assigned', 'Rider Accepted'] };
        } else if (statusFilter === "Completed") {
            query.status = { $in: ['Delivered', 'Completed'] };
        }

        // Get total count for pagination
        const totalItemsCount = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalItemsCount / parseInt(limit));

        const orders = await Order.find(query)
            .populate("items.product", "name image price")
            .populate("rider", "name")
            .populate("user", "fullName name phoneNumber phone")
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
            const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
            const formattedDate = isNaN(orderDate.getTime()) 
                ? "Date Pending" 
                : orderDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).replace(/\//g, "-");

            return {
                id: `#${order._id.toString().slice(-8).toUpperCase()}`,
                product: productNames.join(", ") || "Order Items",
                date: formattedDate,
                price: retailerOrderTotal > 0 ? retailerOrderTotal.toFixed(2) : (order.totalAmount ? order.totalAmount.toFixed(2) : "0.00"),
                payment: order.paymentStatus || "Pending",
                status: status || "Pending",
                orderType: order.orderType || (order.orderId?.startsWith("SUB-") ? "Subscription" : "One-time"),
                rider: order.rider ? {
                    id: order.rider._id,
                    name: order.rider.name || "Delivery Partner"
                } : null,
                statusHistory: order.statusHistory || [],
                items: retailerItems,
                user: order.user,
                deliveryAddress: order.deliveryAddress,
                deliverySlot: order.deliverySlot || null,
                createdAt: order.createdAt || new Date()
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
        
        // ─── CUSTOMER NOTIFICATION ──────────────────
        createNotification(order.user?._id?.toString() || order.user?.toString(), {
            title: `Order Update! ${status === 'Delivered' ? '🎉' : '🚚'}`,
            message: `Your order #${orderId.slice(-6).toUpperCase()} is now '${status}'.`,
            type: "Order",
            referenceId: order._id.toString(),
            onModel: "AppUser"
        });

        // ─── RETAILER NOTIFICATION (for activity feed) ─────────
        createNotification(retailerId.toString(), {
            title: `Status Updated ✅`,
            message: `Order #${orderId.slice(-6).toUpperCase()} set to '${status}'.`,
            type: "Order",
            referenceId: order._id.toString(),
            onModel: "User"
        });

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
        
        // ─── CUSTOMER NOTIFICATION ──────────────────
        createNotification(order.user?._id?.toString() || order.user?.toString(), {
            title: `Rider Assigned! 🛵`,
            message: `A delivery partner has been assigned to your order #${orderId.slice(-6).toUpperCase()}.`,
            type: "Order",
            referenceId: order._id.toString(),
            onModel: "AppUser"
        });

        // ─── RIDER NOTIFICATION ──────────────────────
        createNotification(riderId.toString(), {
            title: `New Task Assigned! 💧`,
            message: `You have been assigned to deliver order #${orderId.slice(-6).toUpperCase()}.`,
            type: "Order",
            referenceId: order._id.toString(),
            onModel: "User"
        });

        // ─── RETAILER NOTIFICATION ──────────────────
        createNotification(retailerId.toString(), {
            title: `Rider Assigned! ✅`,
            message: `You assigned a rider to Order #${orderId.slice(-6).toUpperCase()}.`,
            type: "Order",
            referenceId: order._id.toString(),
            onModel: "User"
        });

        await emitOrderUpdate(orderId, "Rider Assigned", { orderId, riderId, statusHistory: order.statusHistory }, retailerId, order.user?._id);
        res.status(200).json({ success: true, message: "Rider assigned" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

import Review from "../models/Review.js";
export const getRetailerReviews = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const reviews = await Review.find({ retailer: retailerId })
            .populate("user", "fullName")
            .populate("product", "name image")
            .sort({ createdAt: -1 });

        // Calculate Stats
        const totalReviews = reviews.length;
        let totalStars = 0;
        let positiveCount = 0;
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        reviews.forEach(r => {
            const rating = Math.round(r.rating);
            totalStars += r.rating;
            if (rating >= 4) positiveCount++;
            if (distribution[rating] !== undefined) distribution[rating]++;
        });

        const averageRating = totalReviews > 0 ? (totalStars / totalReviews).toFixed(1) : "0.0";
        const positivePercentage = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;

        // Convert distribution to percentages for frontend
        const distributionPercent = {};
        [5, 4, 3, 2, 1].forEach(star => {
            distributionPercent[star] = totalReviews > 0 ? Math.round((distribution[star] / totalReviews) * 100) : 0;
        });

        // Format reviews list for frontend
        const formattedReviews = reviews.map(r => ({
            id: r._id,
            user: r.user?.fullName || "Valued Customer",
            isVerified: true, // If they order it's verified
            date: new Date(r.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' }),
            product: r.product?.name || "Product",
            rating: r.rating,
            comment: r.comment,
            tags: r.tags || []
        }));

        res.status(200).json({ 
            success: true, 
            data: { 
                reviews: formattedReviews,
                stats: {
                    averageRating,
                    totalReviews,
                    positivePercentage,
                    distribution: distributionPercent
                }
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getDueOrdersForCustomer = async (req, res) => {
    try {
        const { type = 'due' } = req.query;
        const paymentFilter = type === 'paid' ? 'Paid' : 'Due';
        
        const retailer = await User.findById(req.user._id).select('businessDetails.shopName email');
        const customer = await AppUser.findById(req.params.customerId).select('fullName phoneNumber addresses');
        const orders = await Order.find({ user: req.params.customerId, "items.retailer": req.user._id, paymentStatus: paymentFilter }).sort({ createdAt: -1 });
        
        const totalDue = type === 'paid' ? 0 : orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
        res.status(200).json({ 
            success: true, 
            data: { 
                orders,
                totalDue: totalDue.toFixed(2),
                type,
                customer,
                retailer: {
                    name: retailer?.businessDetails?.shopName || 'Retailer',
                    email: retailer?.email || ''
                }
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addManualCustomer = async (req, res) => {
    try {
        const user = await AppUser.create({ ...req.body, addedByRetailer: req.user._id, isManual: true });
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.phoneNumber) {
            return res.status(400).json({ 
                success: false, 
                message: `A customer with the phone number ${req.body.phoneNumber || 'provided'} already exists.` 
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const settleCustomerDue = async (req, res) => {
    try {
        const { customerId, amount } = req.body;
        const retailerId = req.user._id;
        
        if (!customerId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid settlement data" });
        }
        
        // Find all Due orders for this customer + retailer, sort oldest first
        const dueOrders = await Order.find({ 
            user: customerId, 
            "items.retailer": retailerId, 
            paymentStatus: "Due" 
        }).sort({ createdAt: 1 });
        
        let remaining = parseFloat(amount);
        
        for (const order of dueOrders) {
            if (remaining <= 0) break;
            if (remaining >= order.totalAmount) {
                order.paymentStatus = 'Paid';
                remaining -= order.totalAmount;
            } else {
                // Partial: mark as partially paid (leave as Due for now, deduct from total)
                // For simplicity, if partial payment covers this order mark as paid
                order.paymentStatus = 'Paid';
                remaining = 0;
            }
            await order.save();
        }
        
        res.status(200).json({ success: true, message: `Settlement of ₹${amount} applied successfully.` });
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
