import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import * as walletService from "../services/walletService.js";
import { emitOrderUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";
import { getCurrentCommissionRate } from "./commissionController.js";
import Rider from "../models/Rider.js";

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
        let identifiedRetailer = cart.retailer; // Initial identifier

        for (const item of cart.items) {
            const currentPrice = item.product.price;
            if (item.product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for ${item.product.name}. Available: ${item.product.stock}kg`
                });
            }

            // Fallback: If cart.retailer is missing, use the retailer from the product itself
            const itemRetailer = item.product.retailer || identifiedRetailer;
            if (!identifiedRetailer) identifiedRetailer = itemRetailer;

            totalAmount += currentPrice * item.quantity;
            orderItems.push({
                product: item.product._id,
                retailer: itemRetailer,
                quantity: item.quantity,
                price: currentPrice,
                status: "Pending"
            });
        }

        if (!identifiedRetailer) {
            return res.status(400).json({ success: false, message: "Retailer not identified for items in cart" });
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

        // 3. Get current commission rate
        const commissionRate = await getCurrentCommissionRate();
        const commissionAmount = parseFloat(((totalAmount * commissionRate) / 100).toFixed(2));

        // 4. Generate Order ID
        const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 5. Create Order
        const order = await Order.create({
            orderId,
            user: userId,
            items: orderItems,
            totalAmount,
            deliveryAddress,
            paymentMethod,
            paymentStatus: paymentMethod === "Wallet" ? "Paid" : "Pending",
            orderType: orderType || "One-time",
            commissionRate,
            commissionAmount
        });

        // 5. Update Stock & Check for Low Inventory
        for (const item of cart.items) {
            const updatedProduct = await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { stock: -item.quantity } },
                { new: true }
            );

            if (updatedProduct.stock <= 5) {
                createNotification(identifiedRetailer.toString(), {
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
        await emitOrderUpdate(order.orderId, "Pending", order, identifiedRetailer, userId);

        // Create Notification for Retailer
        createNotification(identifiedRetailer.toString(), {
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
            .populate("rider", "name email phone")
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
            .populate("rider", "name email phone")
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
export const getOrderTracking = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name email phone")
            .populate("subscriptionId", "frequency customDays");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Authorization: ensure the order belongs to the requester
        if (order.user.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// export const handleBulkOrders = async (req, res) => {
//     try {
//         const retailerId = req.user._id;

//         // Find orders that need processing
//         const ordersToProcess = await Order.find({
//             "items.retailer": retailerId,
//             status: { $in: ["Pending", "Accepted", "Rider Assigned"] },
//             $or: [
//                 { rider: null },
//                 { rider: { $exists: false } }
//             ]
//         });

//         if (ordersToProcess.length === 0) {
//             return res.status(200).json({ 
//                 success: true, 
//                 message: "No orders to process",
//                 processed: 0 
//             });
//         }

//         // Get available riders
//         const availableRiders = await Rider.find({ 
//             status: "Available"
//         }).populate('user', 'name');

//         if (availableRiders.length === 0) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: "No riders available for assignment" 
//             });
//         }

//         let processedCount = 0;
//         const processedOrders = [];

//         for (let i = 0; i < ordersToProcess.length; i++) {
//             const order = ordersToProcess[i];
//             const randomIndex = Math.floor(Math.random() * availableRiders.length);
//             const rider = availableRiders[randomIndex];

//             try {
//                 order.rider = rider._id;
//                 order.riderAssignmentStatus = "Pending";
//                 order.status = "Processing";
//                 await order.save();
//                 processedCount++;
//                 processedOrders.push({
//                     orderId: order.orderId,
//                     riderName: rider.user?.name,
//                     riderId: rider._id
//                 });

//                 // ✅ EMIT SOCKET EVENT FOR REAL-TIME UI UPDATE
//                 const io = getIO();
//                 if (io) {
//                     io.to(`retailer_${retailerId}`).emit("orderUpdate", {
//                         orderId: order.orderId,
//                         status: "Processing",
//                         rider: rider._id,
//                         riderName: rider.user?.name,
//                         data: order
//                     });
//                 }

//             } catch (err) {
//                 console.error(`Failed to process order ${order.orderId}:`, err.message);
//             }
//         }

//         res.status(200).json({
//             success: true,
//             message: `Processed ${processedCount} orders successfully`,
//             processed: processedCount,
//             total: ordersToProcess.length,
//             orders: processedOrders
//         });

//     } catch (error) {
//         console.error("Bulk process error:", error);
//         res.status(500).json({ 
//             success: false, 
//             message: error.message 
//         });
//     }
// }

export const handleBulkOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;

        console.log(`🏪 Processing bulk orders for retailer: ${retailerId}`);

        // Find orders for THIS retailer only that need processing
        const ordersToProcess = await Order.find({
            "items.retailer": retailerId,
            status: { $in: ["Pending", "Accepted", "Rider Assigned"] },
            $or: [
                { rider: null },
                { rider: { $exists: false } }
            ]
        }).populate('rider', 'name user')  // ← Populate rider
            .populate('rider.user', 'name')   // ← Populate rider's user
            .sort({ createdAt: -1 });

        if (ordersToProcess.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No orders to process",
                processed: 0,
                total: 0
            });
        }

        console.log(`📦 Found ${ordersToProcess.length} orders to process`);

        // Get riders for THIS retailer only
        const availableRiders = await Rider.find({
            retailer: retailerId,
            status: "Available"
        }).populate('user', 'name');

        if (availableRiders.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No riders available for your shop. Please add riders first.",
                processed: 0,
                total: ordersToProcess.length
            });
        }

        console.log(`🚴 Found ${availableRiders.length} available riders for this shop`);

        // Make all riders available (optional - ensures they're Available)
        await Rider.updateMany(
            { retailer: retailerId },
            { $set: { status: "Available" } }
        );

        let processedCount = 0;
        let failedCount = 0;
        const processedOrdersList = [];
        const failedOrdersList = [];

        // Process each order
        for (let i = 0; i < ordersToProcess.length; i++) {
            const order = ordersToProcess[i];
            // Pick random rider from available riders
            const randomIndex = Math.floor(Math.random() * availableRiders.length);
            const rider = availableRiders[randomIndex];
            const riderName = rider.user?.name || rider._id;

            try {
                // Update order with rider and status
                order.rider = rider._id;
                order.riderAssignmentStatus = "Pending";
                order.status = "Processing";
                await order.save();

                processedCount++;
                processedOrdersList.push({
                    orderId: order.orderId,
                    riderName: riderName,
                    riderId: rider._id,
                    status: "Processing"
                });

                console.log(`✅ Assigned ${riderName} to order ${order.orderId}`);

                // Emit socket event for real-time UI update
                try {
                    const io = req.app.get('io');
                    if (io) {
                        io.to(`retailer_${retailerId}`).emit("orderUpdate", {
                            orderId: order.orderId,
                            status: "Processing",
                            rider: rider._id,
                            riderName: riderName,
                            data: order
                        });

                        // Also emit to admin room
                        io.to("admin").emit("orderUpdate", {
                            orderId: order.orderId,
                            status: "Processing",
                            rider: rider._id,
                            riderName: riderName,
                            retailerId: retailerId
                        });
                    }
                } catch (socketError) {
                    console.log("Socket emit error:", socketError.message);
                }

            } catch (err) {
                failedCount++;
                failedOrdersList.push({
                    orderId: order.orderId,
                    error: err.message
                });
                console.error(`❌ Failed to process order ${order.orderId}:`, err.message);
            }
        }

        // Return success response
        return res.status(200).json({
            success: true,
            message: `Processed ${processedCount} orders successfully`,
            processed: processedCount,
            failed: failedCount,
            total: ordersToProcess.length,
            orders: processedOrdersList,
            failedOrders: failedOrdersList
        });

    } catch (error) {
        console.error("❌ Bulk process error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
            processed: 0,
            total: 0
        });
    }
};