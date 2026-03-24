import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import crypto from "crypto"
import nodemailer from "nodemailer"
import { createNotification } from "../services/notificationService.js";

// Register
export const registerUser = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body

        const existingUser = await ( User.findOne({ email }) || User.findOne({phone}))
        if (existingUser) return res.status(400).json({ message: "User already exists" })

        const hashedPassword = await bcrypt.hash(password, 12)

        const newUser = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            status: "draft",
            role: "retailer"
        })

        await newUser.save()

        createNotification(newUser._id.toString(), {
            title: "Welcome to Shrimpbite! 🦐",
            message: "Your retailer account has been created. Please complete your onboarding to start selling.",
            type: "System"
        });

        const token = jwt.sign({ id: newUser._id, role: "retailer" }, process.env.JWT_SECRET, { expiresIn: "1d" })

        res.status(201).json({ token, user: { _id: newUser._id, name, email, status: newUser.status, role: "retailer", isShopActive: newUser.isShopActive } })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message || "Something went wrong" })
    }
}

// Login
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body

        // Special handling for test accounts
        if (email === "admin@test.com" && password === "123456") {
            const token = jwt.sign({ id: "admin-test-id", role: "admin" }, process.env.JWT_SECRET, { expiresIn: "11d" })
            return res.status(200).json({ token, user: { id: "admin-test-id", name: "Admin Test", email, role: "admin", status: "approved" } })
        }

        if (email === "retailer@test.com" && password === "123456") {
            const token = jwt.sign({ id: "retailer-test-id", role: "retailer" }, process.env.JWT_SECRET, { expiresIn: "1d" })
            return res.status(200).json({ token, user: { id: "retailer-test-id", name: "Retailer Test", email, role: "retailer", status: "approved" } })
        }

        const user = await User.findOne({ email })
        if (!user) return res.status(404).json({ message: "User doesn't exist" })

        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" })

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })

        res.status(200).json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                email,
                status: user.status,
                role: user.role,
                isShopActive: user.isShopActive
            }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message || "Something went wrong" })
    }
}

// Onboarding
export const onboardUser = async (req, res) => {
    try {
        const { userId, alternateContact, whatsappNumber, businessDetails } = req.body

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: "User not found" })

        user.alternateContact = alternateContact
        user.whatsappNumber = whatsappNumber
        user.businessDetails = businessDetails
         console.log("1")
        user.status = "under_review"
        console.log("2")
        await user.save()
        console.log("3")

        res.status(200).json({ message: "Onboarding details submitted", status: user.status })
    } catch (error) {
         console.error("Onboarding error:", error)

        if (error.name === "ValidationError") {
            const fields = Object.keys(error.errors).join(", ")
            return res.status(400).json({
                message: `Validation failed for: ${fields}`,
                details: error.errors
            })
        }

        if (error.name === "CastError") {
            return res.status(400).json({
                message: `Invalid value for field: ${error.path}`
            })
        }

        res.status(500).json({ message: "Something went wrong Local test" })
    }
}

// Get Me (Current User)
export const getCurrentUser = async (req, res) => {
    try {
        // Special handling for test accounts
        if (req.params.id === "admin-test-id") {
            return res.status(200).json({
                _id: "admin-test-id",
                name: "Admin Test",
                email: "admin@test.com",
                role: "admin",
                status: "approved"
            })
        }
        if (req.params.id === "retailer-test-id") {
            return res.status(200).json({
                _id: "retailer-test-id",
                name: "Retailer Test",
                email: "retailer@test.com",
                role: "retailer",
                status: "approved",
                businessDetails: {
                    businessName: "Test Retailer Shop",
                    ownerName: "Retailer Test Owner",
                    businessType: "Retailer",
                    location: {
                        city: "Test City",
                        hub: "Main Hub"
                    }
                }
            })
        }

        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: "User not found" })

        res.status(200).json(user)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Something went wrong" })
    }
}

// Update Retailer Profile (Shop Settings)
export const updateRetailerProfile = async (req, res) => {
    try {
        const { businessDetails, whatsappNumber, alternateContact } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "Retailer not found" });

        if (businessDetails) {
            user.businessDetails = {
                ...user.businessDetails,
                ...businessDetails,
                // Ensure we don't accidentally wipe location or legal if not provided
                location: {
                    ...(user.businessDetails?.location || {}),
                    ...(businessDetails.location || {})
                },
                legal: {
                    ...(user.businessDetails?.legal || {}),
                    ...(businessDetails.legal || {})
                }
            };
        }

        if (whatsappNumber) user.whatsappNumber = whatsappNumber;
        if (alternateContact) user.alternateContact = alternateContact;

        await user.save();
        res.status(200).json({ success: true, message: "Profile updated successfully", data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Something went wrong" });
    }
};
