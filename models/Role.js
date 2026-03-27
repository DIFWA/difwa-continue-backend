import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ""
    },
    permissions: {
        type: [String],
        default: []
    },
    securityLevel: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

export default mongoose.model("Role", roleSchema, "roles");
