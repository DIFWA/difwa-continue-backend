import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema({
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Paid", "Rejected"],
        default: "Pending"
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    processedAt: Date,
    adminComment: String,
    transactionId: String, // Payment gateway reference
    bankDetails: {
        bankName: String,
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String
    }
}, { timestamps: true });

export default mongoose.model("Payout", payoutSchema);
