import mongoose from "mongoose";

const appUserSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            unique: true,
            sparse: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
        },
        referralCode: {
            type: String,
            unique: true,
            sparse: true
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AppUser'
        },
        password: {
            type: String,
            required: false,
        },
        firebaseUid: {
            type: String,
            unique: true,
            sparse: true
        },
        isGoogleUser: {
            type: Boolean,
            default: false
        },
        addresses: [
            {
                label: String, // Home / Work
                fullAddress: String,
                city: String,
                state: String,
                pincode: String,
                isDefault: { type: Boolean, default: false }
            }
        ],
        isVerified: {
            type: Boolean,
            default: false,
        },
        walletBalance: {
            type: Number,
            default: 0
        },
        loyaltyPoints: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

export default mongoose.model("AppUser", appUserSchema);