import mongoose from "mongoose";

const commissionSettingSchema = new mongoose.Schema({
    rate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 10 // 10% default commission
    },
    description: {
        type: String,
        default: "Platform commission on all orders"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    history: [
        {
            rate: { type: Number, required: true },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            changedAt: { type: Date, default: Date.now },
            note: { type: String }
        }
    ]
}, { timestamps: true });

export default mongoose.model("CommissionSetting", commissionSettingSchema);
