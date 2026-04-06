import Support from "../models/Support.js";

export const contactAdmin = async (req, res) => {
    try {
        const { type, subject, message } = req.body;
        const support = await Support.create({
            user: req.userId,
            type,
            subject,
            message
        });
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
