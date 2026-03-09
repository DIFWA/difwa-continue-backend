import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true
    },
    sender: {
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        role: { type: String, enum: ["admin", "retailer", "user", "rider"], required: true }
    },
    content: {
        type: String,
        required: true
    },
    attachments: [String],
    readBy: [{
        user: mongoose.Schema.Types.ObjectId,
        at: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
    participants: [{
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        role: { type: String, enum: ["admin", "retailer", "user", "rider"], required: true }
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },
    type: {
        type: String,
        enum: ["support", "order", "direct"],
        default: "direct"
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
    }
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);
export const Chat = mongoose.model("Chat", chatSchema);
