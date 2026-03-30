import CommissionSetting from "../models/CommissionSetting.js";

// ─── ADMIN: Get current commission setting ─────────────────────────────────────
export const getCommissionSetting = async (req, res) => {
    try {
        let setting = await CommissionSetting.findOne({ isActive: true })
            .populate("updatedBy", "name email")
            .populate("history.changedBy", "name email");

        if (!setting) {
            // Auto-create a default 10% setting
            setting = await CommissionSetting.create({ rate: 10 });
        }

        res.status(200).json({ success: true, data: setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Update commission rate ────────────────────────────────────────────
export const updateCommissionSetting = async (req, res) => {
    try {
        const { rate, description, note } = req.body;
        const adminId = req.user?.id || req.user?._id;

        if (rate === undefined || rate === null) {
            return res.status(400).json({ success: false, message: "Commission rate is required" });
        }

        if (typeof rate !== "number" || rate < 0 || rate > 100) {
            return res.status(400).json({ success: false, message: "Commission rate must be a number between 0 and 100" });
        }

        let setting = await CommissionSetting.findOne({ isActive: true });

        if (!setting) {
            setting = new CommissionSetting({ rate, description: description || "Platform commission", updatedBy: adminId });
        } else {
            // Push current to history
            setting.history.push({
                rate: setting.rate,
                changedBy: adminId,
                note: note || `Rate changed from ${setting.rate}% to ${rate}%`
            });
            setting.rate = rate;
            setting.description = description || setting.description;
            setting.updatedBy = adminId;
        }

        await setting.save();

        res.status(200).json({
            success: true,
            message: `Commission rate updated to ${rate}%`,
            data: setting
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── PUBLIC / RETAILER: Get current commission rate (minimal) ─────────────────
export const getPublicCommissionRate = async (req, res) => {
    try {
        let setting = await CommissionSetting.findOne({ isActive: true }).select("rate description updatedAt");

        if (!setting) {
            setting = { rate: 10, description: "Platform commission on all orders" };
        }

        res.status(200).json({
            success: true,
            data: {
                rate: setting.rate,
                description: setting.description,
                updatedAt: setting.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Helper: Get current commission rate (used by orderController) ─────────────
export const getCurrentCommissionRate = async () => {
    try {
        const setting = await CommissionSetting.findOne({ isActive: true }).select("rate");
        return setting ? setting.rate : 10; // fallback to 10%
    } catch {
        return 10;
    }
};
