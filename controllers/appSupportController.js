import Support from "../models/Support.js";
import AppSetting from "../models/AppSetting.js";
import AppUser from "../models/AppUser.js";
import { sendSupportNotificationEmail } from "../services/emailService.js";

export const contactAdmin = async (req, res) => {
    try {
        const { type, subject, message } = req.body;
        const support = await Support.create({
            user: req.userId,
            type,
            subject,
            message
        });
        
        try {
            // Find user email if possible
            const appUser = await AppUser.findById(req.userId);
            const userEmail = appUser?.email || "Unknown";
            
            let setting = await AppSetting.findOne();
            let adminEmails = setting?.supportEmails && setting.supportEmails.length > 0 
                ? setting.supportEmails 
                : ["pritamcodeservir@gmail.com"];
                
            await sendSupportNotificationEmail(adminEmails, subject, message, userEmail);
        } catch (emailError) {
            console.error("Failed to send support notification email:", emailError);
            // Non-blocking error, so we continue
        }

        res.status(201).json({ success: true, message: "Support request sent successfully", data: support });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSupportRequests = async (req, res) => {
    try {
        const requests = await Support.find({ user: req.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
