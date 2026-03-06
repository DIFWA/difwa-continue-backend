import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    addAddress,
    getAddresses,
    deleteAddress
} from "../controllers/appAuthController.js";
import { getPublicCategories } from "../controllers/adminController.js";
import { getPublicSubscriptionPlans } from "../controllers/subscriptionController.js";
import { getPublicShops, getShopDetails, getShopProducts } from "../controllers/shopController.js";
import { addToCart, getCart, clearCart } from "../controllers/cartController.js";

// Categories (Public for App)
router.get("/categories", getPublicCategories);

// Shops (Public for App)
router.get("/shops", getPublicShops);
router.get("/shops/:id", getShopDetails);
router.get("/shops/:shopId/products", getShopProducts);

// Subscription Plans (Public for App - Protected)
router.get("/subscriptions", protectAppUser, getPublicSubscriptionPlans);

//register
router.post("/register", registerUser);

//login
router.post("/login", loginUser);

//get profile
router.get("/profile", protectAppUser, getProfile);

//update profile
router.put("/profile", protectAppUser, updateProfile);

//change password
router.put("/change-password", protectAppUser, changePassword);

//forgot password
router.post("/forgot-password", forgotPassword);

//add address
router.post("/addaddress", protectAppUser, addAddress);

//get addresses
router.get("/address", protectAppUser, getAddresses);

//delete address
router.delete("/address/:id", protectAppUser, deleteAddress);

// --- Cart ---
router.get("/cart", protectAppUser, getCart);
router.post("/cart/item", protectAppUser, addToCart);
router.delete("/cart", protectAppUser, clearCart);

export default router;