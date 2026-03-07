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

const router = express.Router();

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

export default router;
