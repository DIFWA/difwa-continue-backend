import AppUser from "../models/AppUser.js"; // 👈 back to AppUser

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: "title and body required" });
        }

        const users = await AppUser.find({ fcmToken: { $ne: null } }); // 👈 AppUser

        if (users.length === 0) {
            return res.status(200).json({ message: "No users with FCM tokens found", count: 0 });
        }

        const tokens = users.map(u => u.fcmToken);
        const adminFCM = (await import("../config/firebase.js")).default;

        const response = await adminFCM.messaging().sendEachForMulticast({
            notification: { title, body },
            tokens,
        });

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