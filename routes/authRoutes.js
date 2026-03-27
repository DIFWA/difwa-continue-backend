import express from "express"
import {
    registerUser,
    loginUser,
    onboardUser,
    getCurrentUser,
    verifyOtp,
    loginRegisterWithMobileNumber,
    verifyOtp1
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

// for. mobile register 
router.post("/send-otp-for-mobile-login-register", loginRegisterWithMobileNumber)
router.post("/verify-otp2", verifyOtp1
)


export default router
