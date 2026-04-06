import mongoose from "mongoose";

const supportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    type: {
        type: String,
        enum: ["Help", "Contact", "Rating", "Complaint"],
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["Pending", "Resolved", "In-Progress"],
        default: "Pending"
    },
    attachment: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model("Support", supportSchema);
