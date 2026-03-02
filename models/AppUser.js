import mongoose from "mongoose";

const appUserSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
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
        password: {
            type: String,
            required: true,
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
    },
    { timestamps: true }
);

export default mongoose.model("AppUser", appUserSchema);