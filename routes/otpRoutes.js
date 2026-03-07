import express from "express";
import otpGenerator from "otp-generator";
import AppUser from "../models/AppUser.js";
import Otp from "../models/Otp.js";

const router = express.Router();

// send otp
router.post("/send", async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required" });

        // Generate 6 digit OTP
        const otpCode = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        // Expiry 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Save/Update OTP in DB
        await Otp.findOneAndUpdate(
            { phoneNumber },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        console.log(`[OTP] for ${phoneNumber}: ${otpCode}`);

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            otp: otpCode
        });
    } catch (error) {
        console.error("otp send error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// verify otp
router.post("/verify", async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and OTP are required" });
        }

        const otpRecord = await Otp.findOne({ phoneNumber });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "No OTP found for this number" });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: "OTP expired" });
        }

        // OTP is valid!
        // Mark user as verified
        const user = await AppUser.findOneAndUpdate(
            { phoneNumber },
            { isVerified: true },
            { new: true }
        );

        // Delete OTP after successful verification
        await Otp.deleteOne({ phoneNumber });

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully. User is now verified.",
            isVerified: user ? user.isVerified : false
        });
    } catch (error) {
        console.error("otp verify error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;