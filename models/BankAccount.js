import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema({
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    bankName: {
        type: String,
        required: true
    },
    accountHolderName: {
        type: String,
        required: true
    },
    accountNumber: {
        type: String,
        required: true
    },
    ifscCode: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        enum: ["Savings", "Current"],
        default: "Savings"
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("BankAccount", bankAccountSchema);
