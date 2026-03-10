import User from "../models/User.js";
import Order from "../models/Order.js";
import RiderModel from "../models/Rider.js";
import bcrypt from "bcryptjs";
import { emitOrderUpdate, emitRiderAssigned } from "../services/socketService.js";

export const getRiderOrders = async (req, res) => {
    try {
        const orders = await Order.find({ rider: req.user.id })
            .populate("user", "fullName phoneNumber")
            .populate("items.product", "name")
            .populate("items.retailer", "businessDetails")
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateDeliveryStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const riderId = req.user.id;

        const order = await Order.findOne({ orderId, rider: riderId }).populate("items.retailer");
        if (!order) return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });

        // Guard: prevent setting the same status again
        if (order.status === status) {
            return res.status(400).json({ success: false, message: `Order is already in '${status}' status.` });
        }

        order.status = status;
        if (status === "Delivered") order.deliveredAt = new Date();
        order.items.forEach(item => { item.status = status; });

        // Push to statusHistory
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push({
            status,
            changedBy: riderId,
            role: 'rider',
            timestamp: new Date()
        });

        await order.save();

        const retailerId = order.items[0]?.retailer?._id || order.items[0]?.retailer;
        const userId = order.user;
        emitOrderUpdate(orderId, status, { orderId, status, statusHistory: order.statusHistory }, retailerId, userId);

        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateRiderLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const userId = req.user.id;

        await User.findByIdAndUpdate(userId, {
            "location.coordinates": [lng, lat],
            isOnline: true
        });

        const activeOrders = await Order.find({
            rider: userId,
            status: { $in: ["Accepted", "Out for Delivery"] }
        });

        activeOrders.forEach(order => {
            // Room is order_{orderId}
            emitOrderUpdate(`order_${order.orderId}`, "RIDER_LOCATION_UPDATE", {
                lat,
                lng,
                orderId: order.orderId
            });
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const completeDelivery = async (req, res) => {
    try {
        const { orderId, itemWeights } = req.body; // itemWeights: [{ productId, weight }]
        const riderId = req.user.id;

        const order = await Order.findOne({ orderId, rider: riderId }).populate("items.product");
        if (!order) return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });

        let totalRefund = 0;
        const updatedItems = order.items.map(item => {
            const weightInfo = itemWeights?.find(w => w.productId.toString() === item.product._id.toString());
            if (weightInfo && weightInfo.weight < item.quantity) {
                const diff = item.quantity - weightInfo.weight;
                const refundAmount = diff * item.price;
                totalRefund += refundAmount;
                item.deliveredWeight = weightInfo.weight;
            } else {
                item.deliveredWeight = item.quantity;
            }
            return item;
        });

        order.items = updatedItems.map(item => ({ ...item, status: "Delivered" }));
        order.status = "Delivered";
        order.deliveredAt = new Date();
        order.paymentStatus = "Paid";
        await order.save();

        if (totalRefund > 0) {
            await walletService.adjustBalance(
                order.user,
                "appUser",
                totalRefund,
                "Credit",
                `Weight Variation Refund: Order #${orderId}`,
                "Refund",
                order._id
            );
        }

        // Update Rider status to Online
        await RiderModel.findOneAndUpdate({ user: riderId }, { status: "Online" });

        const retailerId = order.items[0]?.retailer;
        emitOrderUpdate(orderId, "DELIVERED", { orderId, refund: totalRefund }, retailerId);

        res.status(200).json({ success: true, message: "Order delivered successfully", refund: totalRefund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- RETAILER SIDE MANAGEMENT ---

export const addRider = async (req, res) => {
    try {
        const { name, email, password, phone, vehicleType, plateNumber } = req.body;
        const retailerId = req.user.id;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "A user with this email already exists" });

        // Create User account
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: "rider",
            status: "approved"
        });
        await user.save();

        // Create Rider profile
        const RiderModel = (await import("../models/Rider.js")).default;
        const rider = new RiderModel({
            user: user._id,
            retailer: retailerId,
            vehicleDetails: { vehicleType, plateNumber },
            status: "Offline"
        });
        await rider.save();

        res.status(201).json({ success: true, message: "Rider added successfully", data: { id: rider._id, name: user.name } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerRiders = async (req, res) => {
    try {
        const RiderModel = (await import("../models/Rider.js")).default;
        const riders = await RiderModel.find({ retailer: req.user.id }).populate("user", "name email phone");
        res.status(200).json({ success: true, data: riders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateRiderStatusByRetailer = async (req, res) => {
    try {
        const { status } = req.body;
        const RiderModel = (await import("../models/Rider.js")).default;
        const rider = await RiderModel.findOneAndUpdate(
            { _id: req.params.id, retailer: req.user.id },
            { status },
            { new: true }
        );
        if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });
        res.status(200).json({ success: true, data: rider });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const respondToOrderAssignment = async (req, res) => {
    try {
        const { orderId, response } = req.body; // response: "Accepted" or "Rejected"
        const riderId = req.user.id;

        const order = await Order.findOne({ orderId })
            .populate("items.retailer")
            .populate("user", "fullName phoneNumber _id")
            .populate("items.product", "name");

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        order.riderAssignmentStatus = response;
        if (response === "Accepted") {
            order.status = "Accepted";
            order.rider = riderId;

            // Track status history
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push({
                status: "Accepted",
                changedBy: riderId,
                role: 'rider',
                timestamp: new Date()
            });
        }

        await order.save();

        const retailerId = order.items[0]?.retailer?._id || order.items[0]?.retailer;
        const userId = order.user?._id || order.user;

        // Emit general order update to retailer & user rooms
        emitOrderUpdate(orderId, response, { orderId, response, order }, retailerId, userId);

        // If accepted — emit special riderAssigned popup event to user with rider details
        if (response === "Accepted") {
            const riderUser = await User.findById(riderId, "name phone");
            emitRiderAssigned(orderId, userId, {
                name: riderUser?.name || "Your Rider",
                phone: riderUser?.phone || "",
                riderId
            });
        }

        res.status(200).json({ success: true, message: `Order ${response.toLowerCase()} successfully`, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const updateRider = async (req, res) => {
    try {
        const { name, phone, vehicleType, plateNumber } = req.body;
        const riderId = req.params.id;
        const retailerId = req.user.id;

        const rider = await RiderModel.findOne({ _id: riderId, retailer: retailerId });
        if (!rider) return res.status(404).json({ success: false, message: "Rider not found or unauthorized" });

        // Update User info
        await User.findByIdAndUpdate(rider.user, { name, phone });

        // Update Rider vehicle details
        rider.vehicleDetails = { vehicleType, plateNumber };
        await rider.save();

        const updatedRider = await RiderModel.findById(riderId).populate("user", "name email phone");

        res.status(200).json({ success: true, message: "Rider updated successfully", data: updatedRider });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteRider = async (req, res) => {
    try {
        const RiderModel = (await import("../models/Rider.js")).default;
        const rider = await RiderModel.findOne({ _id: req.params.id, retailer: req.user.id });

        if (!rider) {
            return res.status(404).json({ success: false, message: "Rider not found" });
        }
        await User.findByIdAndDelete(rider.user);
        await RiderModel.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: "Rider deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
