import AppUser from "../models/AppUser.js";
import { sendPushNotification, sendEmailReceipt } from "../services/notificationService.js";

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body, targetType } = req.body; // targetType: 'all', 'retailer', 'rider', 'customer'

        // Find users based on type if needed. For now, sending to all customers
        const users = await AppUser.find({});

        const notifications = users.map(user => {
            if (user.fcmToken) {
                return sendPushNotification(user.fcmToken, title, body);
            }
        });

        await Promise.all(notifications);
        res.json({ message: "Bulk notifications sent", count: users.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const sendBulkEmail = async (req, res) => {
    try {
        const { subject, htmlContent } = req.body;
        const users = await AppUser.find({ email: { $exists: true } });

        const emails = users.map(user => {
            // Placeholder for generic bulk email logic
            console.log(`Sending email to ${user.email}: ${subject}`);
            // return sendEmailReceipt(user.email, { orderId: 'BULK', html: htmlContent });
        });

        res.json({ message: "Bulk emails initiated", count: users.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
