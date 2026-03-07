import express from "express"
import {
    getRetailers,
    updateRetailerStatus,
    getAppUsers,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controllers/adminController.js";
import {
    getSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan
} from "../controllers/subscriptionController.js";

const router = express.Router()

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



export default router
