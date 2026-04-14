import User from "../models/User.js";
import AppUser from "../models/AppUser.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import Role from "../models/Role.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Payout from "../models/Payout.js";
import Favorite from "../models/Favorite.js";
import Subscription from "../models/Subscription.js";
import Transaction from "../models/Transaction.js";
import bcrypt from "bcryptjs";
import { sendInviteEmail } from "../services/emailService.js";
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
                { phone: { $regex: search, $options: "i" } },
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

// Delete retailer
export const deleteRetailer = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Retailer not found",
            });
        }

        // Check if it's actually a retailer
        if (user.role !== "retailer") {
            return res.status(400).json({
                success: false,
                message: "User is not a retailer",
            });
        }

        // Step-by-step cleanup of MongoDB
        const retailerId = id;

        // 1. Get all products to clean up related data like favorites
        const products = await Product.find({ retailer: retailerId }).select("_id");
        const productIds = products.map(p => p._id);

        // 2. Delete all products of this retailer
        await Product.deleteMany({ retailer: retailerId });

        // 3. Delete favorites of those products
        await Favorite.deleteMany({ product: { $in: productIds } });

        // 4. Delete reviews for this retailer or their products
        await Review.deleteMany({
            $or: [
                { retailer: retailerId },
                { product: { $in: productIds } }
            ]
        });

        // 5. Delete payouts
        await Payout.deleteMany({ retailer: retailerId });

        // 6. Delete subscriptions
        await Subscription.deleteMany({ retailer: retailerId });

        // 7. Delete orders (any order that has an item belonging to this retailer)
        await Order.deleteMany({ "items.retailer": retailerId });

        // 8. Finally delete the User (Retailer profile)
        await User.findByIdAndDelete(retailerId);

        res.status(200).json({
            success: true,
            message: "Retailer and all associated data (products, orders, reviews, etc.) removed permanently from MongoDB",
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

        // Total Commission Revenue
        const revenueResult = await Order.aggregate([
            { $match: { status: "Delivered" } },
            {
                $group: {
                    _id: null,
                    totalCommission: { $sum: "$commissionAmount" },
                    totalGross: { $sum: "$totalAmount" }
                }
            }
        ]);

        const totalCommissionRevenue = revenueResult.length > 0 ? revenueResult[0].totalCommission : 0;
        const totalGrossVolume = revenueResult.length > 0 ? revenueResult[0].totalGross : 0;

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
                    canceledOrders,
                    totalCommissionRevenue,
                    totalGrossVolume
                },
                chartData,
                recentShops
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all orders for admin
export const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", status, type } = req.query;
        const query = {};

        if (status && status !== "All") {
            query.status = status;
        }

        if (type && type !== "All") {
            query.orderType = type;
        }

        if (search) {
            // Find User IDs by phone or name
            const matchingUsers = await AppUser.find({
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { phoneNumber: { $regex: search, $options: "i" } }
                ]
            }).select("_id");

            // Find Retailer IDs by business name or name
            const matchingRetailers = await User.find({
                role: "retailer",
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { "businessDetails.businessName": { $regex: search, $options: "i" } }
                ]
            }).select("_id");

            query.$or = [
                { orderId: { $regex: search, $options: "i" } },
                { user: { $in: matchingUsers.map(u => u._id) } },
                { "items.retailer": { $in: matchingRetailers.map(r => r._id) } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await Order.find(query)
            .populate("items.product", "name image price")
            .populate("items.retailer", "name businessDetails")
            .populate("user", "name fullName phoneNumber phone") // Cover all variations
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalOrders = await Order.countDocuments(query);

        // Stats for admin
        const pendingOrders = await Order.countDocuments({ status: { $in: ["Pending", "Accepted", "Processing", "Preparing", "Shipped", "Out for Delivery", "Rider Assigned", "Rider Accepted"] } });
        const completedOrders = await Order.countDocuments({ status: { $in: ["Delivered", "Completed"] } });
        const canceledOrders = await Order.countDocuments({ status: "Cancelled" });

        res.status(200).json({
            success: true,
            data: {
                orders,
                stats: {
                    totalOrders,
                    pendingOrders,
                    completedOrders,
                    canceledOrders,
                    avgOrderValue: "0.00"
                },
                pagination: {
                    totalOrders,
                    totalPages: Math.ceil(totalOrders / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- ROLE MANAGEMENT ---
export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find().populate("updatedBy", "name").sort({ name: 1 });
        res.status(200).json({ success: true, data: roles });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createRole = async (req, res) => {
    try {
        const { name, description, permissions, securityLevel } = req.body;
        const role = await Role.create({ name, description, permissions, securityLevel, updatedBy: req.user.id });
        res.status(201).json({ success: true, data: role });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: "Role already exists" });
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions, securityLevel } = req.body;
        
        const existingRole = await Role.findById(id);
        if (!existingRole) return res.status(404).json({ success: false, message: "Role not found" });
        if (existingRole.isSystem) {
            return res.status(403).json({ success: false, message: "System roles are locked and cannot be modified." });
        }

        const role = await Role.findByIdAndUpdate(id, {
            name,
            description,
            permissions,
            securityLevel,
            updatedBy: req.user.id
        }, { new: true });
        
        res.status(200).json({ success: true, data: role });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const role = await Role.findById(id);
        if (!role) return res.status(404).json({ success: false, message: "Role not found" });
        if (role.isSystem) {
            return res.status(403).json({ success: false, message: "System roles are locked and cannot be deleted." });
        }
        
        await Role.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- ADMIN INVITATION ---
export const inviteAdminUser = async (req, res) => {
    try {
        const { name, email, roleId } = req.body;

        if (!name || !email || !roleId) {
            return res.status(400).json({ success: false, message: "Name, email and roleId are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User with this email already exists" });
        }

        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({ success: false, message: "Role not found" });
        }

        // Generate a random temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: "admin",
            roleId: roleId,
            isFirstLogin: true,
            status: "approved"
        });

        // Send invitation email
        const emailSent = await sendInviteEmail(email, tempPassword, role.name);

        res.status(201).json({
            success: true,
            message: emailSent ? "Invitation sent successfully" : "User created but failed to send email",
            data: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: role.name
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const changeAdminPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Incorrect current password" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.isFirstLogin = false;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAdminProfile = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                return res.status(400).json({ success: false, message: "Email already in use" });
            }
            user.email = email;
        }

        await user.save();
        res.status(200).json({ success: true, message: "Profile updated successfully", data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// --- ADMIN USER MANAGEMENT ---
export const getAdminUsers = async (req, res) => {
    try {
        const admins = await User.find({ role: "admin" })
            .populate("roleId", "name permissions isSystem")
            .populate("updatedBy", "name")
            .select("-password")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: admins });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAdminUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleId, permissions } = req.body;

        const admin = await User.findById(id).populate("roleId");
        if (!admin || admin.role !== "admin") {
            return res.status(404).json({ success: false, message: "Admin user not found" });
        }

        // --- System User Protection ---
        if (admin.roleId && admin.roleId.isSystem) {
             if (roleId && roleId !== admin.roleId._id.toString()) {
                 return res.status(403).json({ success: false, message: "Cannot change the role of a System-level Administrator." });
             }
             if (permissions !== undefined && req.user.id !== id) {
                 return res.status(403).json({ success: false, message: "Only the System Administrator can modify their own permissions." });
             }
        }
        // ------------------------------

        if (roleId) {
            const role = await Role.findById(roleId);
            if (!role) {
                return res.status(404).json({ success: false, message: "Role not found" });
            }
            admin.roleId = roleId;
        }

        if (permissions !== undefined) {
            admin.permissions = permissions;
            admin.updatedBy = req.user.id; // Record who changed the direct permissions
        }

        await admin.save();

        res.status(200).json({ success: true, message: "Admin user updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteAdminUser = async (req, res) => {
    try {
        const { id } = req.params;
        // admin can't delete themselves
        if(id === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot delete yourself" });
        }
        
        const admin = await User.findById(id).populate("roleId");

        if (!admin || admin.role !== "admin") {
            return res.status(404).json({ success: false, message: "Admin user not found" });
        }

        if (admin.roleId && admin.roleId.isSystem) {
            return res.status(403).json({ success: false, message: "System-level Administrators cannot be deleted." });
        }

        await User.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Admin user deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- GLOBAL TRANSACTION DASHBOARD ---
export const getGlobalTransactions = async (req, res) => {
    try {
        const { search = "", page = 1, limit = 20, type, status, source } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        if (type && type !== "All") query.type = type;
        if (status && status !== "All") query.status = status;
        if (source && source !== "All") query.source = source;

        if (search) {
            // Search customers
            const appUsers = await AppUser.find({
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { phoneNumber: { $regex: search, $options: "i" } }
                ]
            }).select("_id");
            
            // Search retailers
            const users = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { phoneNumber: { $regex: search, $options: "i" } },
                    { "businessDetails.businessName": { $regex: search, $options: "i" } }
                ]
            }).select("_id");
            
            const allUserIds = [...appUsers.map(u => u._id), ...users.map(u => u._id)];
            
            query.$or = [
                { user: { $in: allUserIds } },
                { referenceId: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                // This allows searching by the MongoDB _id string
                { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: search, options: "i" } } }
            ];
        }

        const total = await Transaction.countDocuments(query);
        const transactions = await Transaction.find(query)
            .populate("user", "fullName phoneNumber email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // --- PERFORMANCE OPTIMIZATION: One-pass Stats ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const statsResult = await Transaction.aggregate([
            { $match: { type: "Credit", status: "Success" } },
            {
                $group: {
                    _id: null,
                    totalInflow: { $sum: "$amount" },
                    todayInflow: {
                        $sum: {
                            $cond: [{ $gte: ["$createdAt", today] }, "$amount", 0]
                        }
                    }
                }
            }
        ]);

        const platformStats = statsResult[0] || { totalInflow: 0, todayInflow: 0 };

        res.status(200).json({
            success: true,
            data: transactions,
            stats: {
                totalInflow: platformStats.totalInflow,
                todayInflow: platformStats.todayInflow,
                transactionCount: total
            },
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// --- GLOBAL SEARCH SYSTEM ---
export const getGlobalSearch = async (req, res) => {
    try {
        const { q = "" } = req.query;
        if (!q || q.length < 2) return res.status(200).json({ success: true, results: [] });

        const searchRegex = { $regex: q, $options: "i" };

        // 1. Search App Users (Customers)
        const appUsers = await AppUser.find({
            $or: [
                { fullName: searchRegex },
                { phoneNumber: searchRegex },
                { email: searchRegex }
            ]
        }).limit(3).select("fullName phoneNumber profilePicture");

        // 2. Search Retailers
        const retailers = await User.find({
            role: "retailer",
            $or: [
                { name: searchRegex },
                { "businessDetails.businessName": searchRegex },
                { phoneNumber: searchRegex }
            ]
        }).limit(3).select("name businessDetails");

        // 3. Search Orders
        const orders = await Order.find({
            $or: [
                { orderId: searchRegex },
                { status: searchRegex }
            ]
        }).limit(4).select("orderId totalAmount status");

        // 4. Search Transactions
        const transactions = await Transaction.find({
            $or: [
                { referenceId: searchRegex },
                { description: searchRegex },
                { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: q, options: "i" } } }
            ]
        }).limit(3).select("referenceId amount type");

        // Format unified results
        const results = [];

        appUsers.forEach(u => results.push({ id: u._id, title: u.fullName, subtitle: u.phoneNumber, category: "Customer", url: `/admin/app-users?search=${u.phoneNumber}` }));
        retailers.forEach(r => results.push({ id: r._id, title: r.businessDetails?.businessName || r.name, subtitle: "Retailer Shop", category: "Retailer", url: `/admin/retailers?search=${r.businessDetails?.businessName || r.name}` }));
        orders.forEach(o => results.push({ id: o._id, title: o.orderId, subtitle: `₹${o.totalAmount} • ${o.status}`, category: "Order", url: `/admin/orders?search=${o.orderId}` }));
        transactions.forEach(t => results.push({ id: t._id, title: t.referenceId || "Platform Txn", subtitle: `${t.type} • ₹${t.amount}`, category: "Transaction", url: `/admin/transactions?search=${t.referenceId || t._id}` }));

        res.status(200).json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
