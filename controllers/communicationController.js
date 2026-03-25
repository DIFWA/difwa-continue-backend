import User from "../models/User.js";
import admin from "../config/firebase.js";

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: "title and body required" });
        }

        const users = await User.find({ fcmToken: { $ne: null } });

        if (users.length === 0) {
            return res.status(200).json({ message: "No users with FCM tokens found", count: 0 });
        }

        const tokens = users.map(u => u.fcmToken);

        const response = await admin.messaging().sendEachForMulticast({
            notification: { title, body },
            tokens,
        });

        console.log(`✅ Sent: ${response.successCount} | ❌ Failed: ${response.failureCount}`);

        res.json({ 
            message: "Bulk notifications sent", 
            sent: response.successCount,
            failed: response.failureCount
        });
    } catch (error) {
        console.error("Bulk notification error:", error.message);
        res.status(500).json({ message: error.message });
    }
};

export const sendBulkEmail = async (req, res) => {
    try {
        const { subject, htmlContent } = req.body;
        res.json({ message: "Bulk emails initiated" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};