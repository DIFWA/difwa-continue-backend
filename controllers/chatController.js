import { Chat, Message } from "../models/Chat.js";
import { emitChatUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";

export const createChat = async (req, res) => {
    try {
        const { participants, type, orderId } = req.body;
        // Logic to check if chat between these participants already exists
        let chat = await Chat.findOne({
            participants: { $all: participants },
            type,
            orderId
        });

        if (!chat) {
            chat = await Chat.create({ participants, type, orderId });
        }

        res.status(201).json({ success: true, data: chat });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { chatId, content, attachments } = req.body;
        const sender = { id: req.user.id, role: req.user.role };

        const message = await Message.create({
            chat: chatId,
            sender,
            content,
            attachments
        });

        const chat = await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id }, { new: true });

        // Identify Recipient for Push Notification
        const recipient = chat.participants.find(p => p.id.toString() !== req.user.id.toString());
        
        if (recipient) {
            createNotification(recipient.id.toString(), {
                title: `New Message from ${req.user.name || "Support"}`,
                message: content.length > 50 ? content.substring(0, 50) + "..." : content,
                type: "Chat",
                referenceId: chatId,
                onModel: (recipient.role === "user" || recipient.role === "customer") ? "AppUser" : "User"
            });
        }

        // Emit via Socket for real-time update in active chat
        emitChatUpdate(chatId, message);

        res.status(201).json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyChats = async (req, res) => {
    try {
        const chats = await Chat.find({
            "participants.id": req.user.id
        }).populate("lastMessage").sort({ updatedAt: -1 });

        res.status(200).json({ success: true, data: chats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
