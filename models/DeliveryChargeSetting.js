import mongoose from "mongoose";

/**
 * Admin-controlled delivery charge slabs.
 * Example:
 *   { minKm: 0,  maxKm: 2,  charge: 0  }  → Free
 *   { minKm: 2,  maxKm: 5,  charge: 20 }  → ₹20
 *   { minKm: 5,  maxKm: 8,  charge: 40 }  → ₹40
 *   { minKm: 8,  maxKm: 12, charge: 70 }  → ₹70
 */
const deliveryChargeSettingSchema = new mongoose.Schema({
    slabs: [
        {
            minKm: { type: Number, required: true },
            maxKm: { type: Number, required: true },
            charge: { type: Number, required: true, min: 0 }
        }
    ],
    maxDeliveryKm: {
        type: Number,
        default: 30,
        required: true
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
            slabs: Array,
            maxDeliveryKm: Number,
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            changedAt: { type: Date, default: Date.now },
            note: { type: String }
        }
    ]
}, { timestamps: true });

export default mongoose.model("DeliveryChargeSetting", deliveryChargeSettingSchema);
