import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import { adjustBalance } from "../services/walletService.js";
import { emitOrderUpdate, emitShopStatusUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";

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
            .select("businessDetails name email isShopActive");

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

        // Broadcast the status change in real-time
        await emitShopStatusUpdate(user._id, user.isShopActive);

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
        await emitOrderUpdate(orderId, "Weight Finalized", { orderId, itemId, actualWeight, actualPrice }, retailerId);

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

        // --- FETCH RECENT ACTIVITIES ---
        const recentActivities = [];

        // 1. New Orders (Last 5)
        const recentOrders = await Order.find({ "items.retailer": retailerId })
            .select("orderId user createdAt items status statusHistory")
            .populate("user", "fullName")
            .sort({ createdAt: -1 })
            .limit(10);

        recentOrders.forEach(order => {
            // New Order Activity
            recentActivities.push({
                id: `new_${order._id}`,
                type: 'order_new',
                title: 'New Order Received',
                message: `Order #${order.orderId.slice(-6).toUpperCase()} from ${order.user?.fullName || 'Customer'}`,
                timestamp: order.createdAt,
                status: 'info'
            });

            // Specific Status Changes (Delivered, Cancelled, Shipped)
            order.statusHistory.forEach(h => {
                if (['Delivered', 'Cancelled', 'Shipped', 'Out for Delivery'].includes(h.status)) {
                    recentActivities.push({
                        id: `status_${order._id}_${h.status}`,
                        type: 'order_status',
                        title: `Order ${h.status}`,
                        message: `Order #${order.orderId.slice(-6).toUpperCase()} is now ${h.status}`,
                        timestamp: h.timestamp,
                        status: h.status === 'Delivered' ? 'success' : (h.status === 'Cancelled' ? 'error' : 'warning')
                    });
                }
            });
        });

        // 2. Low Stock Alerts
        const lowStockProducts = await Product.find({ 
            retailer: retailerId, 
            stock: { $lt: 5 }, 
            status: "Published" 
        }).limit(5);

        lowStockProducts.forEach(product => {
            recentActivities.push({
                id: `stock_${product._id}`,
                type: 'low_stock',
                title: 'Low Stock Alert',
                message: `${product.name} has only ${product.stock} units left!`,
                timestamp: product.updatedAt,
                status: 'warning'
            });
        });

        // 3. New Customers (Joined via this retailer)
        const recentCustomers = await AppUser.find({ addedByRetailer: retailerId })
            .sort({ createdAt: -1 })
            .limit(5);

        recentCustomers.forEach(cust => {
            recentActivities.push({
                id: `cust_${cust._id}`,
                type: 'customer_new',
                title: 'New Customer Joined',
                message: `${cust.fullName || 'A new customer'} joined your shop directory.`,
                timestamp: cust.createdAt,
                status: 'success'
            });
        });

        // Sort everything by timestamp and limit to 10
        const finalActivities = recentActivities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalRevenue,
                    totalOrders,
                    newOrders: newOrdersCount,
                    activeProducts,
                    totalCustomers,
                    isShopActive: (await User.findById(retailerId)).isShopActive
                },
                chartData,
                recentActivities: finalActivities
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
        const orders = await Order.find({ "items.retailer": retailerId }).populate("user", "fullName email phoneNumber profilePicture isManual addresses");

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
                    orderIds: [order.orderId],
                    firstOrderDate: order.createdAt,
                    lastOrderDate: order.createdAt
                });
            } else {
                const customerData = customerMap.get(customerId);
                customerData.orderCount++;
                customerData.totalSpend += orderSpendForRetailer;
                if (!customerData.orderIds.includes(order.orderId)) {
                    customerData.orderIds.push(order.orderId);
                }
                if (new Date(order.createdAt) > new Date(customerData.lastOrderDate)) {
                    customerData.lastOrderDate = order.createdAt;
                }
                if (new Date(order.createdAt) < new Date(customerData.firstOrderDate)) {
                    customerData.firstOrderDate = order.createdAt;
                }
            }
        });

        // 2. Also get manually added customers who might NOT have orders yet
        const manualCustomers = await AppUser.find({ addedByRetailer: retailerId });
        manualCustomers.forEach(user => {
            const customerId = user._id.toString();
            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    user: user,
                    orderCount: 0,
                    totalSpend: 0,
                    orderIds: [],
                    firstOrderDate: user.createdAt,
                    lastOrderDate: user.createdAt
                });
            }
        });

        const myCustomersArray = Array.from(customerMap.values()).map(({ user, orderCount, totalSpend, orderIds, firstOrderDate, lastOrderDate }) => {
            let status = "Active";
            if (user.isManual) status = "Manual";
            if (orderCount > 3 || totalSpend > 2000) status = "VIP";
            else if (new Date(firstOrderDate) >= thirtyDaysAgo) status = "New";

            if (new Date(firstOrderDate) >= thirtyDaysAgo) {
                newCustomersCount++;
            }
            if (orderCount > 1) {
                repeatCustomersCount++;
            }

            // Get customer balance for THIS retailer
            const balanceEntry = user.retailerBalances?.find(b => b.retailer?.toString() === retailerId.toString());
            const balance = balanceEntry ? balanceEntry.balance : 0;

            return {
                id: user._id,
                name: user.fullName || "Customer",
                email: user.email || "N/A",
                phone: user.phoneNumber || "N/A",
                orderCount,
                orderIds,
                spend: totalSpend.toFixed(2),
                balance: balance.toFixed(2),
                status,
                image: user.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${(user.fullName || 'User').replace(/\s+/g, '')}`,
                isManual: user.isManual || false,
                addresses: user.addresses || []
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

export const addManualCustomer = async (req, res) => {
    try {
        const { fullName, phoneNumber } = req.body;
        const retailerId = req.user._id;

        if (!fullName || !phoneNumber) {
            return res.status(400).json({ success: false, message: "Name and Phone number are required" });
        }

        let user = await AppUser.findOne({ phoneNumber });

        if (user) {
            // Already exists - just ensure linked to this retailer if not already
            if (!user.addedByRetailer) {
                user.addedByRetailer = retailerId;
                await user.save();
            }
            return res.status(200).json({ 
                success: true, 
                message: "Customer linked successfully", 
                data: user 
            });
        }

        user = await AppUser.create({
            fullName,
            phoneNumber,
            addedByRetailer: retailerId,
            isManual: true,
            isVerified: false
        });

        res.status(201).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createManualOrder = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId, items } = req.body;

        if (!customerId || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Customer ID and items are required" });
        }

        // 1. Validate Customer
        const customer = await AppUser.findById(customerId);
        if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

        // 2. Validate Products and Calculate Total
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            totalAmount += product.price * item.quantity;
            orderItems.push({
                product: product._id,
                retailer: retailerId,
                quantity: item.quantity,
                price: product.price,
                status: "Accepted" // Manual orders are usually already accepted by the retailer
            });

            // Update Stock
            product.stock -= item.quantity;
            await product.save();
        }

        // 3. Create Order
        const { paymentMethod = "Cash", paymentStatus = "Pending", deliveryAddress } = req.body;
        
        // SYNC ADDRESS to Customer Profile (so it shows in mobile app)
        if (deliveryAddress && typeof deliveryAddress === 'string') {
            const addressExists = customer.addresses.some(a => a.fullAddress === deliveryAddress);
            if (!addressExists) {
                customer.addresses.push({
                    label: "Added by Store",
                    fullAddress: deliveryAddress,
                    isDefault: customer.addresses.length === 0
                });
                // Note: We save customer below in the balance section or here
            }
        }

        const orderId = `ORD-MAN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const order = await Order.create({
            orderId,
            user: customerId,
            items: orderItems,
            totalAmount,
            deliveryAddress: typeof deliveryAddress === 'string' ? { address: deliveryAddress } : (deliveryAddress || { address: "Manual Entry" }),
            paymentMethod,
            paymentStatus,
            status: "Accepted",
            isManual: true,
            statusHistory: [{
                status: "Accepted",
                changedBy: retailerId,
                role: 'retailer',
                timestamp: new Date()
            }]
        });

        // 3.1 Handle Customer Balance and Save Address Sync
        if (paymentStatus === "Due") {
            const balanceIndex = customer.retailerBalances.findIndex(
                b => b.retailer.toString() === retailerId.toString()
            );

            if (balanceIndex !== -1) {
                customer.retailerBalances[balanceIndex].balance += totalAmount;
            } else {
                customer.retailerBalances.push({
                    retailer: retailerId,
                    balance: totalAmount
                });
            }
        }
        await customer.save(); // Saves both balance and new address

        // 4. Emit Socket
        await emitOrderUpdate(orderId, "Accepted", order, retailerId, customerId);

        res.status(201).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId } = req.query;

        // Build query
        const query = { "items.retailer": retailerId };
        if (customerId) {
            query.user = customerId;
        }

        // Fetch all orders containing items from this retailer and populate product, rider, and subscription info
        const orders = await Order.find(query)
            .populate("items.product", "name")
            .populate("rider", "name")
            .populate("subscriptionId", "frequency customDays")
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

            if (['Pending', 'Accepted', 'Processing', 'Preparing', 'Shipped', 'Out for Delivery', 'Rider Assigned', 'Rider Accepted'].includes(status)) {
                pendingOrders++;
            } else if (status === 'Delivered' || status === 'Completed') {
                completedOrders++;
            }

            formattedOrders.push({
                id: order.orderId || `#${order._id.toString().slice(-6).toUpperCase()}`,
                product: productNames.join(", "),
                date: new Date(order.createdAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                }).replace(/\//g, "-"),
                price: retailerOrderTotal.toFixed(2),
                payment: order.paymentStatus,
                status: status,
                orderType: order.orderType || ((order.orderId || "").startsWith("SUB-") ? "Subscription" : "One-time"),
                rider: order.rider,
                subscriptionDetails: order.subscriptionId ? {
                    frequency: order.subscriptionId.frequency,
                    customDays: order.subscriptionId.customDays
                } : null,
                statusHistory: order.statusHistory
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

        // Enforce sequential flow for retailer actions
        // Pending -> Accepted
        // Accepted -> Processing
        if (status === "Accepted" && order.status !== "Pending") {
            return res.status(400).json({ success: false, message: "Order must be 'Pending' to mark as 'Accepted'." });
        }
        if (status === "Processing" && order.status !== "Accepted") {
            return res.status(400).json({ success: false, message: "Order must be 'Accepted' to mark as 'Processing'." });
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

        // Update overall order status
        order.status = status;

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
        await emitOrderUpdate(orderId, status, { orderId, status, statusHistory: order.statusHistory }, retailerId, userId);

        // Notify Retailer if status is Delivered
        if (status === "Delivered") {
            const customer = await (await import("../models/AppUser.js")).default.findById(userId);
            createNotification(retailerId.toString(), {
                title: `Order Delivered! 🎉`,
                message: `Order #${orderId.slice(-6).toUpperCase()} delivered to ${customer?.fullName || "Customer"} customer by your team.`,
                type: "Order",
                referenceId: orderId
            });
        }

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
        order.status = "Rider Assigned"; // Sync main order status
        await order.save();

        // Emit real-time update to retailer and rider
        await emitOrderUpdate(orderId, "Rider Assigned", { orderId, riderId, order }, retailerId, null, riderId);

        res.status(200).json({ success: true, message: "Rider assigned successfully", data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const settleCustomerDue = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId, amount } = req.body;

        if (!customerId || !amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Customer ID and valid amount are required" });
        }

        const customer = await AppUser.findById(customerId);
        if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

        const balanceIndex = customer.retailerBalances.findIndex(
            b => b.retailer.toString() === retailerId.toString()
        );

        if (balanceIndex === -1 || customer.retailerBalances[balanceIndex].balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: "Settlement amount cannot exceed current balance" 
            });
        }

        customer.retailerBalances[balanceIndex].balance -= amount;
        await customer.save();

        res.status(200).json({ 
            success: true, 
            message: "Balance settled successfully", 
            newBalance: customer.retailerBalances[balanceIndex].balance 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createManualSubscription = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId, productId, frequency, customDays, quantity, startDate, endDate, deliveryAddress } = req.body;

        if (!customerId || !productId || !frequency || !quantity) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const customer = await AppUser.findById(customerId);
        if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

        // SYNC ADDRESS to Customer Profile
        if (deliveryAddress && typeof deliveryAddress === 'string') {
            const addressExists = customer.addresses.some(a => a.fullAddress === deliveryAddress);
            if (!addressExists) {
                customer.addresses.push({
                    label: "Added by Store",
                    fullAddress: deliveryAddress,
                    isDefault: customer.addresses.length === 0
                });
                await customer.save();
            }
        }

        const subscription = await Subscription.create({
            user: customerId,
            product: productId,
            retailer: retailerId,
            frequency,
            customDays,
            quantity,
            startDate: startDate || new Date(),
            endDate,
            isManual: true,
            deliveryAddress
        });

        res.status(201).json({ success: true, data: subscription });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerSubscriptions = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId } = req.query;

        const query = { retailer: retailerId };
        if (customerId) query.user = customerId;

        const subscriptions = await Subscription.find(query)
            .populate('user', 'fullName phoneNumber email')
            .populate('product', 'name price images')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: subscriptions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
