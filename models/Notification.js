import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'onModel',
        index: true
    },
    onModel: {
        type: String,
        required: true,
        enum: ['User', 'AppUser'],
        default: 'User'
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["Order", "Rider", "Inventory", "System", "RetailerRegistration"],
        default: "System"
    },
    referenceId: {
        type: String // Order ID, Rider ID, etc.
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);
