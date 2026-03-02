import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AppUser from "../models/AppUser.js";

// Register
export const registerUser = async (req, res) => {
    try {
        const { fullName, username, email, phoneNumber, password, confirmPassword } = req.body;

        if (!fullName || !phoneNumber || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All required fields must be filled" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const existingUser = await AppUser.findOne({
            $or: [{ email }, { username }, { phoneNumber }],
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await AppUser.create({
            fullName,
            username,
            email,
            phoneNumber,
            password: hashedPassword,
        });

        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            data: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                username: newUser.username,
                phoneNumber: newUser.phoneNumber,
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
        const { identifier, password } = req.body; // identifier = email OR username

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: "All fields required" });
        }

        const user = await AppUser.findOne({ $or: [{ email: identifier }, { username: identifier }] });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
                phoneNumber: user.phoneNumber,
            },
        });
    } catch (error) {
        console.error("loginUser error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get profile (expects protect middleware to set req.user)
export const getProfile = async (req, res) => {
    try {
        return res.status(200).json({ success: true, data: req.user });
    } catch (error) {
        console.error("getProfile error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Update profile
export const updateProfile = async (req, res) => {
    try {
        const { fullName, username, email, phoneNumber } = req.body;

        if (!fullName && !username && !email && !phoneNumber) {
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

        // username
        if (username) {
            if (username === user.username) {
                return res.status(400).json({ success: false, message: "Username is same as previous" });
            }
            const usernameExists = await AppUser.findOne({ username });
            if (usernameExists) return res.status(400).json({ success: false, message: "Username already in use" });
            user.username = username;
            updates.push("username");
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

        return res.status(200).json({ success: true, message: "Profile updated successfully", updatedFields: updates, data: user });
    } catch (error) {
        console.error("updateProfile error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while updating profile" });
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

        return res.status(201).json({ success: true, message: "Address added", addresses: user.addresses });
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

        return res.status(200).json({ success: true, message: "Address removed", addresses: user.addresses });
    } catch (error) {
        console.error("deleteAddress error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
