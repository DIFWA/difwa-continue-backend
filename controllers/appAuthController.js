import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import AppUser from "../models/AppUser.js";
import Otp from "../models/Otp.js";
import { sendWelcomeEmail } from "../services/emailService.js";
import admin from "firebase-admin";
import User from "../models/User.js";
// Register



export const sendOtp = async (req, res) => {
    try {
        const { phoneNumber } = req.body
        console.log(req.body, " this is my request body")

        // Normalize: Strip +91 if present
        const phone10 = phoneNumber.startsWith('+91') ? phoneNumber.slice(3) : phoneNumber;

        if (!/^[6-9]\d{9}$/.test(phone10)) {
            return res.status(400).json({
                message: "Enter a valid 10 digit phone number",
                success: false,
            });
        }

        const existingUser = await AppUser.findOne({
            $or: [{ phoneNumber: phone10 }, { phoneNumber: `+91${phone10}` }]
        })
        const existingRider = !existingUser ? await User.findOne({
            $or: [{ phone: phone10 }, { phone: `+91${phone10}` }],
            role: "rider"
        }) : null;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(otp, " this is my otp")

        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        let user;

        if (existingUser) {
            // agar user already hai but verify nahi hua
            user = await AppUser.findByIdAndUpdate(
                existingUser._id,
                { $set: { otp, otpExpiry, isVerified: false } },
                { new: true }
            );
        } else if (existingRider) {
            user = await User.findByIdAndUpdate(
                existingRider._id,
                { $set: { "businessDetails.otp": otp, "businessDetails.otpExpiry": otpExpiry } },
                { new: true }
            );
        } else {

            user = await AppUser.create({
                phoneNumber,
                otp,
                otpExpiry,
                isVerified: false,
            });
        }


        return res.status(200).json({
            message: "OTP sent successfully",
            success: true,
            data: { otp: otp },
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: error.message || "Something went wrong" });

    }
}

export const verifyOtp = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({
                message: "Phone number and OTP are required",
                success: false,
            });
        }

        const phone10 = phoneNumber.startsWith('+91') ? phoneNumber.slice(3) : phoneNumber;

        let user = await AppUser.findOne({
            $or: [{ phoneNumber: phone10 }, { phoneNumber: `+91${phone10}` }]
        });
        let role = "customer";

        if (!user) {
            user = await User.findOne({
                $or: [{ phone: phone10 }, { phone: `+91${phone10}` }],
                role: "rider"
            });
            role = "rider";
        }

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false,
            });
        }

        const otpVal = role === "rider" ? user.businessDetails?.otp : user.otp;
        const expiryVal = role === "rider" ? user.businessDetails?.otpExpiry : user.otpExpiry;

        if (!otpVal) {
            return res.status(400).json({
                message: "No OTP found. Please request a new OTP",
                success: false,
            });
        }

        if (otpVal !== otp) {
            return res.status(400).json({
                message: "OTP not matched",
                success: false,
            });
        }

        if (new Date() > expiryVal) {
            return res.status(400).json({
                message: "OTP expired",
                success: false,
            });
        }

        if (role === "customer") {
            user.isVerified = true;
            user.otp = null;
            user.otpExpiry = null;
        } else {
            user.businessDetails.otp = null;
            user.businessDetails.otpExpiry = null;
        }

        await user.save();

        const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "7d" })

        return res.status(200).json({
            message: "OTP verified successfully",
            success: true,
            data: {
                ...user.toObject(),
                role: role
            },
            token
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: error.message || "Something went wrong",
            success: false,
        });
    }
};


export const registerUser = async (req, res) => {
    console.log("register initiated ======>")
    try {
        const { fullName, email, phoneNumber, password, confirmPassword, fcmToken } = req.body;

        console.log(fcmToken, " this is my fcmToken")

        if (!fullName || !phoneNumber || !password || !confirmPassword || !fcmToken) {
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
            fcmToken
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
                isVerified: newUser.isVerified,
                fcmToken: newUser.fcmToken
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
        const { phoneNumber, password, fcmToken } = req.body;

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

        user = await AppUser.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    fcmToken: fcmToken
                }
            },
            { new: true }
        )

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

// Forgot password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await AppUser.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Generate reset token
        const crypto = await import("crypto");
        const resetToken = crypto.default.randomBytes(32).toString("hex");
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        await user.save();

        // Send email
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const resetLink = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;

        await transporter.sendMail({
            from: `"Difwa Water" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Reset Your Password - Difwa Water",
            html: `
                <h2>Password Reset Request</h2>
                <p>Hi ${user.fullName},</p>
                <p>Click the button below to reset your password. This link expires in <b>15 minutes</b>.</p>
                <a href="${resetLink}" style="background:#007bff;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;display:inline-block;margin:10px 0;">Reset Password</a>
                <p>If you didn't request this, simply ignore this email.</p>
                <p>— Difwa Water Team</p>
            `,
        });

        return res.status(200).json({ success: true, message: "Password reset link sent to your email" });
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

        const { address, fullName } = req.body;

        // If isDefault is true, unset previous defaults
        if (address.isDefault) {
            user.addresses = user.addresses.map(a => ({ ...a.toObject(), isDefault: false }));
        }

        if (fullName) {
            user.fullName = fullName;
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
