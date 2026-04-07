import express from "express";
import { globalSearch, getFilteredProducts } from "../controllers/searchController.js";

const router = express.Router();

// Search route for App Users
router.get("/", globalSearch);

// NEW: Global products with filtering support
router.get("/products", getFilteredProducts);

export default router;
