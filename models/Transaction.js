import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ["Credit", "Debit"],
        required: true
    },
    status: {
        type: String,
        enum: ["Pending", "Success", "Failed"],
        default: "Success"
    },
    description: {
        type: String,
        required: true
    },
    referenceId: String, // Razorpay Order ID or Subscription ID
    source: {
        type: String,
        enum: ["Razorpay", "Wallet", "System Adjustment"],
        required: true
    }
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);
