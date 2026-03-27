import express from "express"
import {
    registerUser,
    loginUser,
    onboardUser,
    getCurrentUser,
    sendOtp,
    verifyOtp
} from "../controllers/authController.js";
import { verify } from "crypto";

const router = express.Router()

// Register
router.post("/register", registerUser)

// Login
router.post("/login", loginUser)

// Onboarding
router.put("/onboarding", onboardUser)

// Get Me (Current User)
router.get("/me/:id", getCurrentUser)
router.post("/send-otp" ,sendOtp)
router.post("/verify-otp", verifyOtp)


export default router
