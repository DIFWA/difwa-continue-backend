import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        retailer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        deliveredWeight: Number, // Post-cleaning actual weight
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Accepted", "Preparing", "Out for Delivery", "Delivered", "Cancelled"],
            default: "Pending"
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    deliveryAddress: {
        address: String,
        city: String,
        state: String,
        pincode: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    orderType: {
        type: String,
        enum: ["One-time", "Subscription"],
        default: "One-time"
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Refunded"],
        default: "Pending"
    },
    paymentMethod: {
        type: String,
        enum: ["Wallet", "Razorpay"],
        required: true
    },
    rider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User" // Riders are also Users with 'rider' role
    },
    riderAssignmentStatus: {
        type: String,
        enum: ["None", "Pending", "Accepted", "Rejected"],
        default: "None"
    },
    deliveredAt: Date
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
