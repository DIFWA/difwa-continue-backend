import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    image: { type: String, required: true },
    actionType: { 
        type: String, 
        enum: ["shop", "product", "url", "none"], 
        default: "none" 
    },
    actionValue: { type: String, default: "" },
    priority: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Banner", bannerSchema);
