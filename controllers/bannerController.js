import Banner from "../models/Banner.js";

// GET /api/admin/banners
export const getAdminBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ priority: 1, createdAt: -1 });
        res.status(200).json({ success: true, data: banners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/admin/banners
export const createBanner = async (req, res) => {
    try {
        const { title, image, actionType, actionValue, priority, isActive } = req.body;
        
        // If no priority is provided, append it to the end
        let finalPriority = priority;
        if (!finalPriority) {
            const lastBanner = await Banner.findOne().sort({ priority: -1 });
            finalPriority = lastBanner ? lastBanner.priority + 1 : 1;
        }

        const newBanner = new Banner({
            title, image, actionType, actionValue, priority: finalPriority, isActive
        });
        await newBanner.save();

        res.status(201).json({ success: true, message: "Banner created successfully", data: newBanner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/admin/banners/:id
export const updateBanner = async (req, res) => {
    try {
        const updatedBanner = await Banner.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedBanner) return res.status(404).json({ success: false, message: "Banner not found" });

        res.status(200).json({ success: true, message: "Banner updated successfully", data: updatedBanner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/admin/banners/:id
export const deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

        res.status(200).json({ success: true, message: "Banner deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/admin/banners/reorder
// Expects body: { banners: [{ _id: "...", priority: 1 }, { _id: "...", priority: 2 }] }
export const reorderBanners = async (req, res) => {
    try {
        const { banners } = req.body;
        if (!Array.isArray(banners)) return res.status(400).json({ success: false, message: "Invalid payload format" });

        const bulkOps = banners.map(b => ({
            updateOne: {
                filter: { _id: b._id },
                update: { priority: b.priority }
            }
        }));

        await Banner.bulkWrite(bulkOps);

        const updatedBanners = await Banner.find().sort({ priority: 1 });
        res.status(200).json({ success: true, message: "Banners reordered successfully", data: updatedBanners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
