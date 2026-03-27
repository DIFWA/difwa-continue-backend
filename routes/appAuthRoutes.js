import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

import {
    registerUser,
    loginUser,
    googleAuth,
    getProfile,
    updateProfile,
    updateName,
    changePassword,
    forgotPassword,
    addAddress,
    getAddresses,
    deleteAddress,
    sendOtp,
    verifyOtp
} from "../controllers/appAuthController.js";
import { getPublicCategories } from "../controllers/adminController.js";
import { getPublicSubscriptionPlans } from "../controllers/subscriptionController.js";
import { getPublicShops, getShopDetails, getShopProducts } from "../controllers/shopController.js";
import { addToCart, getCart, clearCart, updateCartItem, removeFromCart } from "../controllers/cartController.js";
// import { sendOtp, verifyOtp } from "../controllers/authController.js";

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


// OTP flow
router.post("/auth/send-otp", sendOtp);
router.post("/auth/verify-otp", verifyOtp);

//get profile
router.get("/profile", protectAppUser, getProfile);

//update profile
router.put("/profile", protectAppUser, updateProfile);

//update name
router.put("/update-name", protectAppUser, updateName);

//change password
router.put("/change-password", protectAppUser, changePassword);

//forgot password
router.post("/forgot-password", forgotPassword);

//add address
router.post("/addaddress", protectAppUser, addAddress);
router.post("/address", protectAppUser, addAddress); // Alias for Flutter App

//get addresses
router.get("/address", protectAppUser, getAddresses);

//delete address
router.delete("/address/:id", protectAppUser, deleteAddress);

// --- Cart ---
router.get("/cart", protectAppUser, getCart);
router.post("/cart/item", protectAppUser, addToCart);
router.post("/cart/add", protectAppUser, addToCart);       // Alias
router.put("/cart/update", protectAppUser, updateCartItem); // New
router.delete("/cart/remove/:productId", protectAppUser, removeFromCart); // New
router.delete("/cart/clear", protectAppUser, clearCart);   // Alias
router.delete("/cart", protectAppUser, clearCart);

export default router;