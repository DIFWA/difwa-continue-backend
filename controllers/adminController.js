import User from "../models/User.js";
import AppUser from "../models/AppUser.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
// --- CATEGORY CONTROLLERS ---
export const getCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;
        const query = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalCategories = await Category.countDocuments(query);
        const categories = await Category.find(query)
            .sort({ name: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: categories,
            pagination: {
                totalCategories,
                totalPages: Math.ceil(totalCategories / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new category
export const createCategory = async (req, res) => {
    try {
        const { name, image } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Name is required" });

        const category = await Category.create({ name, image });
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Category already exists" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a category
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, image } = req.body;

        const category = await Category.findByIdAndUpdate(id, { name, image }, { new: true, runValidators: true });
        if (!category) return res.status(404).json({ success: false, message: "Category not found" });

        res.status(200).json({ success: true, data: category });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Category already exists" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a category
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndDelete(id);
        if (!category) return res.status(404).json({ success: false, message: "Category not found" });

        res.status(200).json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all app users
export const getAppUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phoneNumber: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalUsers = await AppUser.countDocuments(query);
        const users = await AppUser.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Get all retailers
export const getRetailers = async (req, res) => {
    try {
        const { status, page = 1, limit = 10, search = "" } = req.query;
        const query = { role: "retailer" };
        if (status) query.status = status;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { "businessDetails.businessName": { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalRetailers = await User.countDocuments(query);
        const retailers = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: retailers,
            pagination: {
                totalRetailers,
                totalPages: Math.ceil(totalRetailers / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Update retailer status
export const updateRetailerStatus = async (req, res) => {
    try {
        const { userId, status, rejectionReason } = req.body;

        if (status === "rejected" && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is mandatory for rejecting an application.",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Retailer not found",
            });
        }

        user.status = status;
        if (rejectionReason) user.rejectionReason = rejectionReason;

        await user.save();

        res.status(200).json({
            success: true,
            message: `Retailer ${status} successfully`,
            data: user,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// --- APP PUBLIC API ---
export const getPublicCategories = async (req, res) => {
    try {
        const categories = await Category.find().select("name image").sort({ name: 1 });

        const minimalCategories = categories.map(cat => ({
            id: cat._id,
            name: cat.name,
            image: cat.image || ""
        }));

        res.status(200).json({
            success: true,
            data: minimalCategories
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- DASHBOARD ANALYTICS ---
export const getDashboardStats = async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();

        // New orders (last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const newOrders = await Order.countDocuments({ createdAt: { $gte: yesterday } });

        const completedOrders = await Order.countDocuments({ status: "Delivered" });
        const canceledOrders = await Order.countDocuments({ status: "Cancelled" });

        // Last 7 days chart data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const ordersLast7Days = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
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
                orders: found ? found.count : 0
            });
        }

        // Recent shop activities (recent retailers)
        const recentShops = await User.find({ role: "retailer" })
            .sort({ createdAt: -1 })
            .select("name email businessDetails createdAt")
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalOrders,
                    newOrders,
                    completedOrders,
                    canceledOrders
                },
                chartData,
                recentShops
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};