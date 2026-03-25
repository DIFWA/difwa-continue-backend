import Notification from "../models/Notification.js";
import { emitNotification } from "./socketService.js";
import { sendWelcomeEmail } from "./emailService.js";

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

/**
 * Sends a push notification via FCM.
 */
export const sendPushNotification = async (fcmToken, title, body) => {
    try {
        if (!fcmToken) {
            console.log("No FCM token provided");
            return { success: false };
        }

        const admin = (await import("../config/firebase.js")).default;

        await admin.messaging().send({
            notification: { title, body },
            token: fcmToken,
        });

        console.log(`✅ Push notification sent | Title: ${title}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Push notification failed:", error.message);
        return { success: false };
    }
};

// Send to ALL users
export const sendPushNotificationToAll = async (title, body) => {
    try {
        const User = (await import("../models/User.js")).default;
        const admin = (await import("../config/firebase.js")).default;

        const users = await User.find({ fcmToken: { $ne: null } });

        if (users.length === 0) {
            console.log("No users with FCM tokens");
            return;
        }

        const tokens = users.map(u => u.fcmToken);

        const response = await admin.messaging().sendEachForMulticast({
            notification: { title, body },
            tokens,
        });

        console.log(`✅ Sent: ${response.successCount} | ❌ Failed: ${response.failureCount}`);
        return response;
    } catch (error) {
        console.error("❌ Broadcast failed:", error.message);
    }
};

/**
 * Sends an email receipt/notification.
 */
export const sendEmailReceipt = async (email, { orderId, html }) => {
    console.log(`[Email Receipt] To: ${email} | Order: ${orderId}`);
    // Logic for receipts - can reuse transporter from emailService if needed
    return { success: true };
};
