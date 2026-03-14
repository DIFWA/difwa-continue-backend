import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import AppUser from "../models/AppUser.js";
import Otp from "../models/Otp.js";
import { sendWelcomeEmail } from "../services/emailService.js";
import admin from "firebase-admin";
// Register
export const registerUser = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password, confirmPassword } = req.body;

        if (!fullName || !phoneNumber || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All required fields must be filled" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const existingUser = await AppUser.findOne({
            $or: [{ email }, { phoneNumber }],
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "User with this email or phone number already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await AppUser.create({
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
        });

        // send welcome email (non-blocking)
        try {
            await sendWelcomeEmail(newUser.email, newUser.fullName);
        } catch (error) {
            console.log("Welcome email failed:", error.message);
        }

        // Generate 6 digit OTP
        const otpCode = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        // Expiry 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Save OTP in DB
        await Otp.findOneAndUpdate(
            { phoneNumber },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        console.log(`[REGISTRATION OTP] for ${phoneNumber}: ${otpCode}`);

        return res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify your phone number to login.",
            otp: otpCode, // For development convenience
            data: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                phoneNumber: newUser.phoneNumber,
                isVerified: newUser.isVerified
            },
        });
    } catch (error) {
        console.error("registerUser error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Login
export const loginUser = async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        if (!phoneNumber || !password) {
            return res.status(400).json({ success: false, message: "Phone number and password required" });
        }

        let user = await AppUser.findOne({ phoneNumber });
        let role = "customer";

        if (!user) {
            // Check if it's a Rider (from User collection)
            const User = (await import("../models/User.js")).default;
            user = await User.findOne({
                $or: [{ phone: phoneNumber }, { email: phoneNumber }] // Try both for riders
            });
            if (!user || user.role !== "rider") {
                return res.status(400).json({ success: false, message: "Invalid credentials" });
            }
            role = "rider";
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        if (role === "customer" && !user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Account not verified. Please verify your phone number.",
                phoneNumber: user.phoneNumber
            });
        }

        const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: {
                id: user._id,
                fullName: user.fullName || user.name,
                email: user.email,
                phoneNumber: user.phoneNumber || user.phone,
                role: role
            },
        });
    } catch (error) {
        console.error("loginUser error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getProfile = async (req, res) => {
    try {
        // req.user already has the 'role' added by the middleware
        return res.status(200).json({
            success: true,
            data: req.user,
            message: "Profile fetched successfully"
        });
    } catch (error) {
        console.error("getProfile error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Update profile
export const updateProfile = async (req, res) => {
    try {
        const { fullName, email, phoneNumber } = req.body;

        if (!fullName && !email && !phoneNumber) {
            return res.status(400).json({ success: false, message: "At least one field is required to update" });
        }

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const updates = [];

        // fullName
        if (fullName) {
            if (fullName === user.fullName) {
                return res.status(400).json({ success: false, message: "Full name is same as previous" });
            }
            user.fullName = fullName;
            updates.push("fullName");
        }

        // email
        if (email) {
            if (email === user.email) {
                return res.status(400).json({ success: false, message: "Email is same as previous" });
            }
            const emailExists = await AppUser.findOne({ email });
            if (emailExists) return res.status(400).json({ success: false, message: "Email already in use" });
            user.email = email;
            updates.push("email");
        }

        // phone
        if (phoneNumber) {
            if (phoneNumber === user.phoneNumber) {
                return res.status(400).json({ success: false, message: "Phone number is same as previous" });
            }
            const phoneExists = await AppUser.findOne({ phoneNumber });
            if (phoneExists) return res.status(400).json({ success: false, message: "Phone number already in use" });
            user.phoneNumber = phoneNumber;
            updates.push("phoneNumber");
        }

        await user.save();

        // send welcome email (non-blocking)
        try {
            await sendWelcomeEmail(user.email, user.fullName);
        } catch (error) {
            console.log("Welcome email failed:", error.message);
        }

        return res.status(200).json({ success: true, message: "Profile updated successfully", updatedFields: updates, data: user });
    } catch (error) {
        console.error("updateProfile error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while updating profile" });
    }
};

// Update only Name (Used by Flutter App)
export const updateName = async (req, res) => {
    try {
        const { fullName } = req.body;

        if (!fullName) {
            return res.status(400).json({ success: false, message: "Full name is required" });
        }

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (fullName === user.fullName) {
            return res.status(400).json({ success: false, message: "New name cannot be the same as the current name" });
        }

        user.fullName = fullName;
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: "Name updated successfully", 
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber
            }
        });
    } catch (error) {
        console.error("updateName error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while updating name" });
    }
};

// Change password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Both currentPassword and newPassword are required" });
        }

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Current password incorrect" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        console.error("changePassword error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Forgot password (placeholder)
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await AppUser.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // TODO: generate reset token, save, and send email
        return res.status(200).json({ success: true, message: "Password reset flow to be implemented" });
    } catch (error) {
        console.error("forgotPassword error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Add address
export const addAddress = async (req, res) => {
    try {
        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const address = req.body;

        // If isDefault is true, unset previous defaults
        if (address.isDefault) {
            user.addresses = user.addresses.map(a => ({ ...a.toObject(), isDefault: false }));
        }

        user.addresses.push(address);
        await user.save();

        return res.status(201).json({ success: true, message: "Address added", data: user.addresses });
    } catch (error) {
        console.error("addAddress error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get addresses
export const getAddresses = async (req, res) => {
    try {
        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        return res.status(200).json({ success: true, data: user.addresses });
    } catch (error) {
        console.error("getAddresses error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Delete address
export const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const prevLen = user.addresses.length;
        user.addresses = user.addresses.filter(addr => addr._id.toString() !== id);

        if (user.addresses.length === prevLen) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        await user.save();

        return res.status(200).json({ success: true, message: "Address removed", data: user.addresses });
    } catch (error) {
        console.error("deleteAddress error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
// Google Auth (Firebase)
export const googleAuth = async (req, res) => {
    try {
        const { idToken, phoneNumber } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: "ID Token is required" });
        }

        // Verify Firebase Token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            console.error("Firebase token verification failed:", error.message);
            return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
        }

        const { email, name, uid, picture } = decodedToken;

        // 1. Try to find user by Firebase UID
        let user = await AppUser.findOne({ firebaseUid: uid });

        // 2. If not found by UID, try by Email
        if (!user && email) {
            user = await AppUser.findOne({ email });
        }

        // 3. Handle New User / Missing Phone Number
        if (!user) {
            // New User flow
            if (!phoneNumber) {
                // Return verified info so the app can show a screen to get the phone number
                return res.status(200).json({
                    success: true,
                    new_user: true,
                    message: "User not found. Please provide a phone number to complete registration.",
                    temp_data: { email, name, uid }
                });
            }

            // Check if phone number already belongs to another user
            const phoneExists = await AppUser.findOne({ phoneNumber });
            if (phoneExists) {
                return res.status(400).json({ success: false, message: "Phone number already in use by another account" });
            }

            // Create new Google User
            user = await AppUser.create({
                fullName: name,
                email,
                phoneNumber,
                firebaseUid: uid,
                isGoogleUser: true,
                isVerified: true // Google email is verified
            });

            // Send welcome email
            try {
                await sendWelcomeEmail(user.email, user.fullName);
            } catch (error) {
                console.log("Welcome email failed:", error.message);
            }
        } else {
            // Existing user flow - Ensure fields are updated if needed
            let updated = false;
            if (!user.firebaseUid) {
                user.firebaseUid = uid;
                updated = true;
            }
            if (!user.isGoogleUser) {
                user.isGoogleUser = true;
                updated = true;
            }
            if (updated) await user.save();
        }

        // Finalize Login
        const token = jwt.sign({ id: user._id, role: "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(200).json({
            success: true,
            message: "Google login successful",
            token,
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: "customer"
            },
        });

    } catch (error) {
        console.error("googleAuth error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
