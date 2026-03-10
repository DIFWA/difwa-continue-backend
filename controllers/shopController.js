import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { adjustBalance } from "../services/walletService.js";
import { emitOrderUpdate } from "../services/socketService.js";

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
            .select("name email businessDetails createdAt")
            .sort({ createdAt: -1 });

        const minimalShops = shops.map(shop => ({
            id: shop._id,
            name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
            businessName: shop.businessDetails?.businessName,
            image: shop.businessDetails?.storeImage || "",
            location: shop.businessDetails?.location?.city || "",
            rating: 4.5, // Placeholder for future rating system
            deliveryTime: "30-45 mins" // Placeholder
        }));

        res.status(200).json({
            success: true,
            data: minimalShops
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single shop details
export const getShopDetails = async (req, res) => {
    try {
        const shop = await User.findOne({ _id: req.params.id, role: "retailer", status: "approved" })
            .select("businessDetails name email");

        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found or not approved" });
        }

        res.status(200).json({
            success: true,
            data: {
                id: shop._id,
                name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
                businessName: shop.businessDetails?.businessName,
                image: shop.businessDetails?.storeImage || "",
                address: shop.businessDetails?.location,
                contact: shop.email
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
            .populate("category", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle Shop status (Active/Inactive)
export const toggleShopStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).send("Retailer not found");

        user.isShopActive = !user.isShopActive;
        await user.save();

        res.status(200).json({ success: true, isShopActive: user.isShopActive });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Finalize order weight and handle balance adjustments
export const finalizeOrderWeight = async (req, res) => {
    try {
        const { orderId, itemId, actualWeight } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const item = order.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: "Item not found" });

        // Calculate price difference
        const originalPrice = item.price * item.quantity;
        const actualPrice = item.price * (actualWeight / 1); // Logic depends on unit
        const diff = originalPrice - actualPrice;

        item.deliveredWeight = actualWeight;
        await order.save();

        if (diff > 0) {
            await adjustBalance(
                order.user,
                "appUser",
                diff,
                "Credit",
                `Wallet refund for weight variation in order ${orderId}`,
                "System Adjustment",
                orderId
            );
        }

        // Emit real-time update
        const retailerId = req.user.id;
        emitOrderUpdate(orderId, "Weight Finalized", { orderId, itemId, actualWeight, actualPrice }, retailerId);

        res.status(200).json({ success: true, diff, newPrice: actualPrice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- RETAILER DASHBOARD ANALYTICS ---
export const getRetailerDashboardStats = async (req, res) => {
    try {
        const retailerId = req.user.id;

        // Fetch all orders containing items from this retailer
        const orders = await Order.find({ "items.retailer": retailerId });

        let totalRevenue = 0;
        let totalOrders = orders.length;
        const customerIds = new Set();
        let newOrdersCount = 0;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        orders.forEach(order => {
            customerIds.add(order.user.toString());

            if (new Date(order.createdAt) >= yesterday) {
                newOrdersCount++;
            }

            order.items.forEach(item => {
                if (item.retailer.toString() === retailerId) {
                    totalRevenue += item.price * item.quantity;
                }
            });
        });

        const activeProducts = await Product.countDocuments({ retailer: retailerId, status: "Published" });
        const totalCustomers = customerIds.size;

        // Last 7 days chart data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const ordersLast7Days = await Order.aggregate([
            {
                $match: {
                    "items.retailer": req.user._id, // Match retailer in items
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $unwind: "$items"
            },
            {
                $match: {
                    "items.retailer": req.user._id // Ensure we only sum items for this retailer
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format chart data
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const chartData = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];
            const found = ordersLast7Days.find(o => o._id === dateStr);
            chartData.push({
                name: days[d.getDay()],
                sales: found ? found.revenue : 0
            });
        }

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalRevenue,
                    totalOrders,
                    newOrders: newOrdersCount,
                    activeProducts,
                    totalCustomers
                },
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

        // 1. Calculate Total Earnings (Lifetime) and This Month's Earnings
        const orders = await Order.find({ "items.retailer": retailerId });

        let totalEarnings = 0;
        let earningsThisMonth = 0;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                    const itemRevenue = item.price * item.quantity;
                    totalEarnings += itemRevenue;

                    if (new Date(order.createdAt) >= startOfMonth) {
                        earningsThisMonth += itemRevenue;
                    }
                }
            });
        });

        // 2. Fetch Payouts to calculate Settled and Requested
        const payouts = await Payout.find({ retailer: retailerId });

        let totalSettled = 0;
        let totalRequestedOrPending = 0;

        payouts.forEach(payout => {
            if (payout.status === 'Approved') {
                totalSettled += payout.amount;
                totalRequestedOrPending += payout.amount; // Since it's already approved, it's taken from available balance
            } else if (payout.status === 'Pending') {
                totalRequestedOrPending += payout.amount; // Pending is also locked from available balance
            }
        });

        // 3. Calculate Available Balance
        const availableBalance = totalEarnings - totalRequestedOrPending;

        res.status(200).json({
            success: true,
            data: {
                availableBalance: availableBalance > 0 ? availableBalance : 0,
                estimatedEarnings: earningsThisMonth,
                totalSettled: totalSettled,
                totalEarnings: totalEarnings
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerCustomers = async (req, res) => {
    try {
        const retailerId = req.user._id;

        // 1. Get all orders involving this retailer and populate customer info
        const orders = await Order.find({ "items.retailer": retailerId }).populate("user", "name email phone profilePicture");

        const customerMap = new Map();

        let newCustomersCount = 0;
        let repeatCustomersCount = 0;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        orders.forEach(order => {
            if (!order.user) return; // safety check

            const customerId = order.user._id.toString();

            // Calculate spend ONLY for items from this retailer
            let orderSpendForRetailer = 0;
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                    orderSpendForRetailer += item.price * item.quantity;
                }
            });

            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    user: order.user,
                    orderCount: 1,
                    totalSpend: orderSpendForRetailer,
                    firstOrderDate: order.createdAt,
                    lastOrderDate: order.createdAt
                });
            } else {
                const customerData = customerMap.get(customerId);
                customerData.orderCount++;
                customerData.totalSpend += orderSpendForRetailer;
                if (new Date(order.createdAt) > new Date(customerData.lastOrderDate)) {
                    customerData.lastOrderDate = order.createdAt;
                }
                if (new Date(order.createdAt) < new Date(customerData.firstOrderDate)) {
                    customerData.firstOrderDate = order.createdAt;
                }
            }
        });

        const myCustomersArray = Array.from(customerMap.values()).map(({ user, orderCount, totalSpend, firstOrderDate, lastOrderDate }) => {
            let status = "Active";
            if (orderCount > 3 || totalSpend > 2000) status = "VIP";
            else if (new Date(firstOrderDate) >= thirtyDaysAgo) status = "New";

            if (new Date(firstOrderDate) >= thirtyDaysAgo) {
                newCustomersCount++;
            }
            if (orderCount > 1) {
                repeatCustomersCount++;
            }

            return {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || "+91 0000000000",
                orderCount,
                spend: totalSpend.toFixed(2),
                status,
                image: user.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name.replace(/\s+/g, '')}`
            };
        });

        const totalCustomers = myCustomersArray.length;
        const repeatPercentage = totalCustomers > 0 ? Math.round((repeatCustomersCount / totalCustomers) * 100) : 0;

        // Chart Data - Unique customers per day (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const chartData = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const nextD = new Date(d);
            nextD.setDate(nextD.getDate() + 1);

            // Count unique customers who ordered on this day
            const custsThisDay = new Set();
            orders.forEach(order => {
                if (!order.user) return;
                const orderDate = new Date(order.createdAt);
                if (orderDate >= d && orderDate < nextD) {
                    custsThisDay.add(order.user._id.toString());
                }
            });

            chartData.push({
                name: days[d.getDay()],
                customers: custsThisDay.size
            });
        }

        // Sort customers by highest output
        myCustomersArray.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalCustomers,
                    newCustomers: newCustomersCount,
                    repeatPercentage: `${repeatPercentage}%`
                },
                chartData,
                customers: myCustomersArray
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;

        // Fetch all orders containing items from this retailer and populate product and rider info
        const orders = await Order.find({ "items.retailer": retailerId })
            .populate("items.product", "name")
            .populate("rider", "name")
            .sort({ createdAt: -1 });

        // Calculate Stats
        const totalOrders = orders.length;
        let pendingOrders = 0;
        let completedOrders = 0;
        let totalRevenue = 0;

        const formattedOrders = [];

        orders.forEach(order => {
            let retailerOrderTotal = 0;
            let productNames = [];

            // Filter items specific to this retailer
            const retailerItems = order.items.filter(item => item.retailer && item.retailer.toString() === retailerId.toString());

            retailerItems.forEach(item => {
                retailerOrderTotal += item.price * item.quantity;
                productNames.push(`${item.quantity}x ${item.product?.name || 'Unknown Product'}`);
            });

            totalRevenue += retailerOrderTotal;

            // Determine order status for this retailer
            let status = order.status;

            if (status === 'Pending' || status === 'Processing') {
                pendingOrders++;
            } else if (status === 'Delivered' || status === 'Completed') {
                completedOrders++;
            }

            formattedOrders.push({
                id: order.orderId || `#${order._id.toString().slice(-6).toUpperCase()}`,
                product: productNames.join(", "),
                date: new Date(order.createdAt).toLocaleDateString("en-GB").replace(/\//g, "-"),
                price: retailerOrderTotal.toFixed(2),
                payment: order.paymentStatus,
                status: status,
                orderType: order.orderType || ((order.orderId || "").startsWith("SUB-") ? "Subscription" : "One-time"),
                rider: order.rider
            });
        });

        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00";
        const completedPercentage = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalOrders,
                    pendingOrders,
                    completedOrders,
                    completedPercentage: `${completedPercentage}%`,
                    avgOrderValue: `₹${avgOrderValue}`
                },
                orders: formattedOrders
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateOrderItemStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const retailerId = req.user._id;

        const order = await Order.findOne({ orderId }).populate('user', '_id');
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Guard: prevent setting the same status again
        if (order.status === status) {
            return res.status(400).json({ success: false, message: `Order is already in '${status}' status.` });
        }

        // Update all items belonging to this retailer in this order
        let updated = false;
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                item.status = status;
                updated = true;
            }
        });

        if (!updated) {
            return res.status(400).json({ success: false, message: "No items found for this retailer in this order" });
        }

        // Update overall order status if necessary
        const allItemsStatus = order.items.map(i => i.status);
        if (allItemsStatus.every(s => s === 'Delivered' || s === 'Completed')) {
            order.status = 'Delivered';
        } else if (allItemsStatus.some(s => s === 'Out for Delivery')) {
            order.status = 'Out for Delivery';
        } else if (allItemsStatus.some(s => s === 'Shipped')) {
            order.status = 'Shipped';
        } else if (allItemsStatus.some(s => s === 'Preparing' || s === 'Processing')) {
            order.status = 'Processing';
        } else if (allItemsStatus.some(s => s === 'Accepted')) {
            order.status = 'Accepted';
        }

        // Push to statusHistory audit trail
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push({
            status,
            changedBy: retailerId,
            role: 'retailer',
            timestamp: new Date()
        });

        await order.save();

        // Emit real-time update to order room, retailer room, and user room
        const userId = order.user?._id || order.user;
        emitOrderUpdate(orderId, status, { orderId, status, statusHistory: order.statusHistory }, retailerId, userId);

        res.status(200).json({ success: true, message: "Order status updated successfully", order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

import Review from "../models/Review.js";

export const getRetailerReviews = async (req, res) => {
    try {
        const retailerId = req.user._id;

        const reviews = await Review.find({ retailer: retailerId })
            .populate("user", "name")
            .populate("product", "name")
            .sort({ createdAt: -1 });

        const totalReviews = reviews.length;
        let averageRating = 0;
        let positiveReviews = 0; // >= 4 stars
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        if (totalReviews > 0) {
            let totalRating = 0;
            reviews.forEach(r => {
                totalRating += r.rating;
                distribution[r.rating]++;
                if (r.rating >= 4) positiveReviews++;
            });
            averageRating = (totalRating / totalReviews).toFixed(1);
        }

        const stats = {
            averageRating,
            totalReviews,
            positivePercentage: totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 100) : 0,
            distribution: {
                5: totalReviews > 0 ? Math.round((distribution[5] / totalReviews) * 100) : 0,
                4: totalReviews > 0 ? Math.round((distribution[4] / totalReviews) * 100) : 0,
                3: totalReviews > 0 ? Math.round((distribution[3] / totalReviews) * 100) : 0,
                2: totalReviews > 0 ? Math.round((distribution[2] / totalReviews) * 100) : 0,
                1: totalReviews > 0 ? Math.round((distribution[1] / totalReviews) * 100) : 0,
            }
        };

        const formattedReviews = reviews.map(r => ({
            id: r._id,
            user: r.user ? r.user.name : "Anonymous",
            rating: r.rating,
            comment: r.comment,
            date: new Date(r.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }),
            product: r.product ? r.product.name : "Unknown Product",
            tags: r.tags || [],
            isVerified: true // Mock verified for now
        }));

        res.status(200).json({
            success: true,
            data: {
                stats,
                reviews: formattedReviews
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const assignRiderToOrder = async (req, res) => {
    try {
        const { orderId, riderId } = req.body;
        const retailerId = req.user._id;
        const order = await Order.findOne({ orderId, "items.retailer": retailerId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found or access denied" });
        order.rider = riderId;
        order.riderAssignmentStatus = "Pending";
        await order.save();

        // Emit real-time update
        emitOrderUpdate(orderId, "Rider Assigned", { orderId, riderId }, retailerId);

        res.status(200).json({ success: true, message: "Rider assigned successfully", data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
