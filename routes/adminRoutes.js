import express from "express"
import {
    getRetailers,
    updateRetailerStatus,
    getAppUsers,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getDashboardStats,
    getAllOrders,
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    inviteAdminUser,
    changeAdminPassword
} from "../controllers/adminController.js";
import {
    getSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan
} from "../controllers/subscriptionController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router()

// Dashboard
router.get("/dashboard-stats", protect, adminOnly, getDashboardStats)

// Get all retailers (can filter by status)
router.get("/retailers", getRetailers)

// Get all app users
router.get("/users", getAppUsers)

// Category Management
router.get("/categories", getCategories)
router.post("/categories", createCategory)
router.put("/categories/:id", updateCategory)
router.delete("/categories/:id", deleteCategory)

// Update retailer status (approve/reject/suspend)
router.put("/retailers/status", updateRetailerStatus)

// Subscription Management
router.get("/subscriptions", getSubscriptionPlans)
router.post("/subscriptions", createSubscriptionPlan)
router.put("/subscriptions/:id", updateSubscriptionPlan)
router.delete("/subscriptions/:id", deleteSubscriptionPlan)



// Order Management
router.get("/orders", protect, adminOnly, getAllOrders)

// Role Management
router.get("/roles", protect, adminOnly, getRoles)
router.post("/roles", protect, adminOnly, createRole)
router.put("/roles/:id", protect, adminOnly, updateRole)
router.delete("/roles/:id", protect, adminOnly, deleteRole)

router.post("/invite", protect, adminOnly, inviteAdminUser)

// Change Password
router.put("/change-password", protect, changeAdminPassword)

export default router
