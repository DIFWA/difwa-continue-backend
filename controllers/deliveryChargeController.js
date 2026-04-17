import User from "../models/User.js";
import AppUser from "../models/AppUser.js";
import Order from "../models/Order.js";
import DeliveryChargeSetting from "../models/DeliveryChargeSetting.js";
import {
    getDeliveryChargeSetting,
    calculateDistanceKm,
    resolveDeliveryCharge
} from "../services/deliveryChargeService.js";

// ─── ADMIN: Get current delivery charge settings ───────────────────────────
export const getDeliveryChargeSettings = async (req, res) => {
    try {
        const setting = await getDeliveryChargeSetting();
        res.status(200).json({ success: true, data: setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Update delivery charge slabs ───────────────────────────────────
export const updateDeliveryChargeSettings = async (req, res) => {
    try {
        const { slabs, maxDeliveryKm, note } = req.body;
        const adminId = req.user?.id || req.user?._id;

        if (!slabs || !Array.isArray(slabs) || slabs.length === 0) {
            return res.status(400).json({ success: false, message: "Slabs array is required" });
        }

        // Validate each slab
        for (const slab of slabs) {
            if (slab.minKm === undefined || slab.maxKm === undefined || slab.charge === undefined) {
                return res.status(400).json({ success: false, message: "Each slab must have minKm, maxKm and charge" });
            }
            if (slab.minKm >= slab.maxKm) {
                return res.status(400).json({ success: false, message: `Invalid slab: minKm (${slab.minKm}) must be less than maxKm (${slab.maxKm})` });
            }
            if (slab.charge < 0) {
                return res.status(400).json({ success: false, message: "Delivery charge cannot be negative" });
            }
        }

        let setting = await DeliveryChargeSetting.findOne({ isActive: true });

        if (!setting) {
            setting = new DeliveryChargeSetting({ slabs, maxDeliveryKm: maxDeliveryKm || 30, updatedBy: adminId });
        } else {
            // Save old config to history
            setting.history.push({
                slabs: setting.slabs,
                maxDeliveryKm: setting.maxDeliveryKm,
                changedBy: adminId,
                note: note || "Delivery charge settings updated"
            });
            setting.slabs = slabs;
            setting.maxDeliveryKm = maxDeliveryKm || setting.maxDeliveryKm;
            setting.updatedBy = adminId;
        }

        await setting.save();
        res.status(200).json({ success: true, message: "Delivery charge settings updated", data: setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── APP: Calculate delivery charge before checkout ─────────────────────────
// POST /api/orders/calculate-delivery-fee
// Body: { vendorId, userLat, userLng } OR { vendorId, addressId }
export const calculateDeliveryFee = async (req, res) => {
    try {
        const { vendorId, userLat, userLng, addressId } = req.body;
        const userId = req.userId;

        if (!vendorId) {
            return res.status(400).json({ success: false, message: "vendorId is required" });
        }

        // 1. Get vendor/retailer coordinates
        const vendor = await User.findById(vendorId).select("businessDetails.location");
        if (!vendor) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        const vendorCoords = vendor.businessDetails?.location?.coordinates;
        if (!vendorCoords?.lat || !vendorCoords?.lng) {
            return res.status(422).json({
                success: false,
                message: "Vendor has not set up their store location. Delivery fee cannot be calculated."
            });
        }

        // 2. Get user delivery coordinates
        let destLat = userLat;
        let destLng = userLng;

        // If userLat/Lng not provided, try to get from saved address
        if ((!destLat || !destLng) && addressId) {
            const user = await AppUser.findById(userId).select("addresses");
            const addr = user?.addresses?.id(addressId);
            if (addr?.coordinates?.lat && addr?.coordinates?.lng) {
                destLat = addr.coordinates.lat;
                destLng = addr.coordinates.lng;
            }
        }

        if (!destLat || !destLng) {
            return res.status(400).json({
                success: false,
                message: "User delivery coordinates (userLat, userLng) are required"
            });
        }

        // 3. Calculate distance
        const distanceKm = await calculateDistanceKm(
            vendorCoords.lat,
            vendorCoords.lng,
            parseFloat(destLat),
            parseFloat(destLng)
        );

        // 4. Get admin slab settings and resolve charge
        const setting = await getDeliveryChargeSetting();
        const { charge, slab, deliverable } = resolveDeliveryCharge(distanceKm, setting);

        if (!deliverable) {
            return res.status(200).json({
                success: true,
                deliverable: false,
                distanceKm,
                maxDeliveryKm: setting.maxDeliveryKm,
                message: `Sorry, delivery is not available beyond ${setting.maxDeliveryKm} km. Your distance is ${distanceKm} km.`
            });
        }

        return res.status(200).json({
            success: true,
            deliverable: true,
            distanceKm,
            deliveryFee: charge,
            isFreeDelivery: charge === 0,
            slab: {
                from: slab.minKm,
                to: slab.maxKm,
                charge: slab.charge
            },
            message: charge === 0
                ? "Free delivery for your area!"
                : `Delivery charge ₹${charge} applies for ${distanceKm} km distance.`
        });

    } catch (error) {
        console.error("calculateDeliveryFee error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get delivery income report ────────────────────────────────────
// GET /api/admin/delivery-income?page=1&limit=20&from=&to=
export const getDeliveryIncomeReport = async (req, res) => {
    try {
        const { page = 1, limit = 20, from, to } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Date filter
        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.$lte = toDate;
        }

        const query = {
            status: { $in: ["Delivered", "Completed"] },
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
        };

        const orders = await Order.find(query)
            .populate("user", "fullName phoneNumber")
            .populate("items.retailer", "name businessDetails.businessName businessDetails.location")
            .select("orderId totalAmount deliveryFee distance commissionAmount commissionRate createdAt status paymentMethod")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const totalCount = await Order.countDocuments(query);

        // Aggregate totals
        const totals = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalDeliveryIncome: { $sum: "$deliveryFee" },
                    totalCommissionIncome: { $sum: "$commissionAmount" },
                    totalOrderValue: { $sum: "$totalAmount" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        const summary = totals[0] || {
            totalDeliveryIncome: 0,
            totalCommissionIncome: 0,
            totalOrderValue: 0,
            totalOrders: 0
        };

        res.status(200).json({
            success: true,
            data: {
                orders,
                summary: {
                    ...summary,
                    totalPlatformIncome: summary.totalDeliveryIncome + summary.totalCommissionIncome
                },
                pagination: {
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limitNum),
                    currentPage: pageNum,
                    limit: limitNum
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
