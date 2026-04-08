// import User from "../models/User.js";
// import admin from "../config/firebase.js";
// import AppUser from "../models/AppUser.js";

// export const sendBulkNotification = async (req, res) => {
//     try {
//         const { title, body } = req.body;

//         if (!title || !body) {
//             return res.status(400).json({ message: "title and body required" });
//         }

//         const users = await AppUser.find({ fcmToken: { $ne: null } });

//         if (users.length === 0) {
//             return res.status(200).json({ message: "No users with FCM tokens found", count: 0 });
//         }

//         const tokens = users.map(u => u.fcmToken);

//         const response = await admin.messaging().sendEachForMulticast({
//             notification: { title, body },
//             tokens,
//         });

//         console.log(`✅ Sent: ${response.successCount} | ❌ Failed: ${response.failureCount}`);

//         res.json({
//             message: "Bulk notifications sent",
//             sent: response.successCount,
//             failed: response.failureCount
//         });
//     } catch (error) {
//         console.error("Bulk notification error:", error.message);
//         res.status(500).json({ message: error.message });
//     }
// };

// export const sendBulkEmail = async (req, res) => {
//     try {
//         const { subject, htmlContent } = req.body;
//         res.json({ message: "Bulk emails initiated" });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };


import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "../services/notificationService.js";
import { emitNotification } from "../services/socketService.js";
import { sendMarketingEmail } from "../services/emailService.js";

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body, targetType } = req.body; // targetType: 'all', 'retailer', 'rider', 'customer'
        let pushTokens = [];
        let retailerIds = [];

        // 1. Fetch tokens from AppUser (Customers) - Always FCM
        if (targetType === "all" || targetType === "customer") {
            const customers = await AppUser.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            pushTokens = [...pushTokens, ...customers.map(u => u.fcmToken)];
        }

        // 2. Fetch riders for FCM
        if (targetType === "all" || targetType === "rider") {
            const riders = await User.find({ role: "rider", fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            pushTokens = [...pushTokens, ...riders.map(u => u.fcmToken)];
        }

        // 3. Fetch retailers for Database/Panel AND FCM
        if (targetType === "all" || targetType === "retailer") {
            const retailers = await User.find({ role: "retailer" }).select("_id fcmToken");
            retailerIds = retailers.map(u => u._id);
            // Add retailer tokens if they exist
            const retailerTokens = retailers.map(u => u.fcmToken).filter(token => token && token !== "");
            pushTokens = [...pushTokens, ...retailerTokens];
        }

        // 4. Create Database Notifications for ALL targets (Retailers, Customers, Riders)
        let allRecipientIds = [...retailerIds];

        if (targetType === "all" || targetType === "customer") {
            const allCustomers = await AppUser.find({}).select("_id");
            allRecipientIds = [...allRecipientIds, ...allCustomers.map(u => u._id)];
        }

        if (targetType === "all" || targetType === "rider") {
            const allRiders = await User.find({ role: "rider" }).select("_id");
            allRecipientIds = [...allRecipientIds, ...allRiders.map(u => u._id)];
        }

        if (allRecipientIds.length > 0) {
            const dbNotifications = allRecipientIds.map(id => ({
                recipient: id,
                title,
                message: body,
                type: "System"
            }));

            // Bulk insert into database
            const createdNotifications = await Notification.insertMany(dbNotifications);

            // Emit via socket for real-time web panel update (Retailers only have socket connection based on IDs typically)
            // But we can just loop over created non-customer notifications or emit to all, socketService handles invalid IDs gracefully
            createdNotifications.forEach(notif => {
                emitNotification(notif.recipient.toString(), notif.toObject());
            });
        }

        // 5. Clean push tokens (remove duplicates)
        const uniquePushTokens = [...new Set(pushTokens)];

        // 6. Final verification - If NO push tokens AND NO retailers, then error
        if (uniquePushTokens.length === 0 && retailerIds.length === 0) {
            return res.status(404).json({ success: false, message: "No users found in this segment (Retailers, Riders, or Customers)." });
        }

        // 7. Dispatch FCM only to those in the push list (Customers/Riders)
        if (uniquePushTokens.length > 0) {
            const pushPromises = uniquePushTokens.map(token => sendPushNotification(token, title, body));
            await Promise.all(pushPromises);
        }

        res.json({
            success: true,
            message: `Dispatch successful.`,
            details: {
                pushNotificationsSent: uniquePushTokens.length,
                panelNotificationsSent: retailerIds.length
            }
        });

    } catch (error) {
        console.error("Bulk broadcast error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


export const sendBulkEmail = async (req, res) => {
    try {
        const { subject, htmlContent } = req.body;

        if (!subject || !htmlContent) {
            return res.status(400).json({ success: false, message: "Subject and HTML content are required" });
        }

        // Fetch all approved retailers
        const retailers = await User.find({ role: "retailer", status: "approved" }).select("email");
        const emailList = retailers.map(u => u.email).filter(e => e);

        if (emailList.length === 0) {
            return res.status(404).json({ success: false, message: "No approved retailers with emails found" });
        }

        const success = await sendMarketingEmail(emailList, subject, htmlContent);

        if (success) {
            res.json({
                success: true,
                message: `Email campaign launched successfully to ${emailList.length} retailers.`,
                count: emailList.length
            });
        } else {
            res.status(500).json({ success: false, message: "Failed to dispatch emails" });
        }

    } catch (error) {
        console.error("Bulk email error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};