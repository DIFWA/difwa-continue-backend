import express from "express";
import Category from "../models/Category.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { protect, retailerOnly } from "../middleware/authMiddleware.js";
import {
    getRetailerProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} from "../controllers/productController.js";
import { updateRetailerProfile } from "../controllers/authController.js";
import { toggleShopStatus, finalizeOrderWeight, getRetailerDashboardStats, getRetailerCustomers, addManualCustomer, createManualOrder, settleCustomerDue, createManualSubscription, getRetailerSubscriptions, getRetailerRevenueStats, getRetailerOrders, getRetailerReviews, updateOrderItemStatus, assignRiderToOrder } from "../controllers/shopController.js";
import { searchAnything } from "../controllers/retailerSearchController.js";
import { getDailyPrepList } from "../services/prepService.js";

const router = express.Router();

// Dashboard Stats
router.get("/dashboard-stats", protect, retailerOnly, getRetailerDashboardStats);
router.get("/search", protect, retailerOnly, searchAnything);

// Revenue Stats
router.get("/revenue-stats", protect, retailerOnly, getRetailerRevenueStats);

// Customers
router.get("/customers", protect, retailerOnly, getRetailerCustomers);
router.post("/customers", protect, retailerOnly, addManualCustomer);
router.post("/orders/manual", protect, retailerOnly, createManualOrder);
router.post("/customers/settle-due", protect, retailerOnly, settleCustomerDue);

// Orders
router.get("/orders", protect, retailerOnly, getRetailerOrders);

// Subscriptions
router.get("/subscriptions", protect, retailerOnly, getRetailerSubscriptions);
router.post("/subscriptions/manual", protect, retailerOnly, createManualSubscription);
router.patch("/order-status", protect, retailerOnly, updateOrderItemStatus);
router.post("/assign-rider", protect, retailerOnly, assignRiderToOrder);

// Reviews
router.get("/reviews", protect, retailerOnly, getRetailerReviews);

// Prep List
router.get("/prep-list", protect, retailerOnly, async (req, res) => {
    try {
        const { date } = req.query;
        const requirements = await getDailyPrepList(req.user.id, date);
        res.status(200).json({ success: true, data: requirements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all categories for retailers
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Product Management
router.get("/products", protect, retailerOnly, getRetailerProducts);
router.get("/products/:id", protect, retailerOnly, getProductById);
router.post("/products", protect, retailerOnly, createProduct);
router.put("/products/:id", protect, retailerOnly, updateProduct);
router.delete("/products/:id", protect, retailerOnly, deleteProduct);

// Shop Profile Management
router.put("/profile", protect, retailerOnly, updateRetailerProfile);
router.patch("/toggle-status", protect, retailerOnly, toggleShopStatus);
router.post("/finalize-weight", protect, retailerOnly, finalizeOrderWeight);

export default router;
