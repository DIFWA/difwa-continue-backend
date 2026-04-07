import Notification from "../models/Notification.js";
import { emitNotification } from "./socketService.js";
import { sendWelcomeEmail } from "./emailService.js";

/**
 * Creates a notification in the DB and emits it via socket.
 * @param {string} recipientId - The User ID of the recipient.
 * @param {object} data - { title, message, type, referenceId }
 */
export const createNotification = async (recipientId, { title, message, type, referenceId, onModel = "User" }) => {
    try {
        const notification = await Notification.create({
            recipient: recipientId,
            title,
            message,
            type,
            referenceId,
            onModel
        });

        // Emit via socket
        await emitNotification(recipientId, notification.toObject());

        // ─── PUSH NOTIFICATION ───────────────────────────
        try {
            const User = (await import("../models/User.js")).default;
            const AppUser = (await import("../models/AppUser.js")).default;
            
            // Try to find recipient in both User and AppUser collections
            let user = await User.findById(recipientId).select("fcmToken");
            if (!user) user = await AppUser.findById(recipientId).select("fcmToken");

            if (user?.fcmToken) {
                await sendPushNotification(user.fcmToken, title, message);
            }
        } catch (pushErr) {
            console.error("Push delivery failed:", pushErr.message);
        }

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
        const AppUser = (await import("../models/AppUser.js")).default;
        const admin = (await import("../config/firebase.js")).default;

        const users = await AppUser.find({ fcmToken: { $ne: null } });

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
 * Broadcasts a notification to all Admin users.
 */
export const notifyAdmins = async ({ title, message, type, referenceId }) => {
    try {
        const User = (await import("../models/User.js")).default;
        const admins = await User.find({ role: "admin" }).select("_id");

        if (admins.length > 0) {
            await Promise.all(admins.map(admin => 
                createNotification(admin._id.toString(), { title, message, type, referenceId })
            ));
            console.log(`📡 Broadcast to ${admins.length} Admins completed`);
        }
    } catch (error) {
        console.error("Failed to notify admins:", error.message);
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
