import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ["admin", "retailer", "rider"],
        default: "retailer"
    },
    walletBalance: { type: Number, default: 0 },
    isShopActive: { type: Boolean, default: true },
    phone: {
        type: String,
        required: false
    },
    alternateContact: String,
    whatsappNumber: String,
    status: {
        type: String,
        enum: ["draft", "under_review", "approved", "rejected"],
        default: "draft"
    },
    rejectionReason: {
        type: String,
        default: ""
    },
    businessDetails: {
        businessName: String,
        storeDisplayName: String,
        ownerName: String,
        businessType: {
            type: String,
            enum: ["Water Retail Store", "Water Plant", "Supermarket", "Kirana Store", "Distributor", ""],
            required: false
        },
        yearsInBusiness: String,
        coldStorage: {
            type: String,
            enum: ["Yes", "No"],
            default: "No"
        },
        monthlyPurchaseVolume: String,
        location: {
            address: String,
            city: String,
            state: String,
            pincode: String,
            landmark: String,
            coordinates: {
                lat: Number,
                lng: Number
            }
        },
        legal: {
            gst: String,
            fssai: String,
            licenseUrl: String,
            gstCertificateUrl: String
        },
        storeImage: String,
        deliverySlots: {
            type: [String],
            default: []
        },
        resetPasswordToken: { type: String, default: null },
        resetPasswordExpires: { type: Date, default: null },
        otp: { type: String, default: null },
        otpExpiry: { type: Date, default: null },
    },
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
        default: null
    },
    isFirstLogin: {
        type: Boolean,
        default: true
    },
    permissions: {
        type: [String],
        default: []
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    fcmToken: {
        type: String,
        default: null
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model("User", userSchema, "users")