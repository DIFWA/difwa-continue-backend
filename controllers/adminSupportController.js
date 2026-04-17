import Support from "../models/Support.js";
import AppSetting from "../models/AppSetting.js";

// @desc    Get all support requests
// @route   GET /api/admin/support/requests
// @access  Private/Admin
export const getAllSupportRequests = async (req, res) => {
    try {
        const requests = await Support.find().populate("user", "name email phone").sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get support emails
// @route   GET /api/admin/support/emails
// @access  Private/Admin
export const getSupportEmails = async (req, res) => {
    try {
        let setting = await AppSetting.findOne();
        if (!setting) {
            setting = await AppSetting.create({ supportEmails: ["pritamcodeservir@gmail.com"] });
        }
        res.status(200).json({ success: true, data: setting.supportEmails });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update support emails
// @route   PUT /api/admin/support/emails
// @access  Private/Admin
export const updateSupportEmails = async (req, res) => {
    try {
        const { emails } = req.body;
        if (!emails || !Array.isArray(emails)) {
            return res.status(400).json({ success: false, message: "Emails array is required" });
        }

        let setting = await AppSetting.findOne();
        if (!setting) {
            setting = new AppSetting({ supportEmails: emails });
        } else {
            setting.supportEmails = emails;
        }
        
        await setting.save();
        res.status(200).json({ success: true, message: "Support emails updated successfully", data: setting.supportEmails });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
