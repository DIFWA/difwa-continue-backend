import Banner from "../models/Banner.js";

// GET /api/app/banners
export const getAppBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true })
            .select("-createdAt -updatedAt -__v")
            .sort({ priority: 1 });
            
        res.status(200).json({ success: true, data: banners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
