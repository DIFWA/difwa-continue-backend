import Notification from "../models/Notification.js";
import { emitNotification } from "./socketService.js";

/**
 * Creates a notification in the DB and emits it via socket.
 * @param {string} recipientId - The User ID of the recipient.
 * @param {object} data - { title, message, type, referenceId }
 */
export const createNotification = async (recipientId, { title, message, type, referenceId }) => {
    try {
        const notification = await Notification.create({
            recipient: recipientId,
            title,
            message,
            type,
            referenceId
        });

        // Emit via socket
        await emitNotification(recipientId, notification.toObject());

        return notification;
    } catch (error) {
        console.error("Failed to create notification:", error.message);
    }
};
