import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
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
            enum: ["Seafood Retail Store", "Frozen Products Store", "Supermarket", "Kirana Store", "Distributor"]
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
        },
        legal: {
            gst: String,
            fssai: String,
            licenseUrl: String,
            gstCertificateUrl: String
        },
        storeImage: String
    }
}, { timestamps: true })

export default mongoose.model("User", userSchema, "users")