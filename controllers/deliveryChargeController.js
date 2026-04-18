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
        const { slabs, maxDeliveryKm, note, retailerSlabOptions } = req.body;
        const adminId = req.user?.id || req.user?._id;

        if (!slabs || !Array.isArray(slabs) || slabs.length === 0) {
            return res.status(400).json({ success: false, message: "Slabs array is required" });
        }

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
            setting = new DeliveryChargeSetting({
                slabs,
                maxDeliveryKm: maxDeliveryKm || 30,
                updatedBy: adminId,
                retailerSlabOptions: retailerSlabOptions || []
            });
        } else {
            setting.history.push({
                slabs: setting.slabs,
                maxDeliveryKm: setting.maxDeliveryKm,
                changedBy: adminId,
                note: note || "Delivery charge settings updated"
            });
            setting.slabs = slabs;
            setting.maxDeliveryKm = maxDeliveryKm || setting.maxDeliveryKm;
            setting.updatedBy = adminId;
            if (retailerSlabOptions !== undefined) {
                setting.retailerSlabOptions = retailerSlabOptions;
            }
        }

        await setting.save();
        res.status(200).json({ success: true, message: "Delivery charge settings updated", data: setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Toggle delivery charge permission for a retailer ──────────────
// PATCH /api/delivery-charge/retailer-permission/:retailerId
export const toggleRetailerDeliveryPermission = async (req, res) => {
    try {
        const { retailerId } = req.params;
        const retailer = await User.findById(retailerId);
        if (!retailer || retailer.role !== "retailer") {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }
        retailer.deliveryChargePermission = !retailer.deliveryChargePermission;
        await retailer.save();
        res.status(200).json({
            success: true,
            message: `Delivery charge permission ${retailer.deliveryChargePermission ? "granted" : "revoked"} for ${retailer.name}`,
            deliveryChargePermission: retailer.deliveryChargePermission
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Update only retailerSlabOptions ────────────────────────────────
// PUT /api/delivery-charge/retailer-slab-options
export const updateRetailerSlabOptions = async (req, res) => {
    try {
        const { retailerSlabOptions } = req.body;
        if (!Array.isArray(retailerSlabOptions)) {
            return res.status(400).json({ success: false, message: "retailerSlabOptions must be an array" });
        }
        for (const opt of retailerSlabOptions) {
            if (opt.minKm >= opt.maxKm) {
                return res.status(400).json({ success: false, message: "Invalid option: minKm must be less than maxKm" });
            }
            if (opt.charge < 0) {
                return res.status(400).json({ success: false, message: "Charge cannot be negative" });
            }
        }
        let setting = await DeliveryChargeSetting.findOne({ isActive: true });
        if (!setting) {
            setting = new DeliveryChargeSetting({ slabs: [], retailerSlabOptions });
        } else {
            setting.retailerSlabOptions = retailerSlabOptions;
        }
        await setting.save();
        res.status(200).json({ success: true, message: "Retailer slab options updated", data: setting.retailerSlabOptions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── RETAILER: Get their own delivery charge settings ─────────────────────
// GET /api/retailer/delivery-charges
export const getRetailerDeliveryCharges = async (req, res) => {
    try {
        const retailer = await User.findById(req.user.id).select("deliveryChargePermission retailerDeliverySlabs");
        if (!retailer) return res.status(404).json({ success: false, message: "Retailer not found" });

        const globalSetting = await getDeliveryChargeSetting();

        res.status(200).json({
            success: true,
            data: {
                deliveryChargePermission: retailer.deliveryChargePermission,
                retailerDeliverySlabs: retailer.retailerDeliverySlabs || [],
                availableSlabOptions: globalSetting.retailerSlabOptions || [],
                maxDeliveryKm: globalSetting.maxDeliveryKm
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── RETAILER: Update their own delivery charge slabs ────────────────────
// PUT /api/retailer/delivery-charges
export const updateRetailerDeliveryCharges = async (req, res) => {
    try {
        const { slabs } = req.body;
        const retailer = await User.findById(req.user.id);
        if (!retailer) return res.status(404).json({ success: false, message: "Retailer not found" });

        if (!retailer.deliveryChargePermission) {
            return res.status(403).json({ success: false, message: "You do not have permission to set custom delivery charges" });
        }

        if (!Array.isArray(slabs)) {
            return res.status(400).json({ success: false, message: "slabs must be an array" });
        }

        for (const slab of slabs) {
            if (slab.minKm >= slab.maxKm) {
                return res.status(400).json({ success: false, message: "Invalid slab: minKm must be less than maxKm" });
            }
            if (slab.charge < 0) {
                return res.status(400).json({ success: false, message: "Charge cannot be negative" });
            }
        }

        retailer.retailerDeliverySlabs = slabs;
        retailer.markModified("retailerDeliverySlabs");
        await retailer.save();

        res.status(200).json({ success: true, message: "Delivery charges updated", data: retailer.retailerDeliverySlabs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── APP: Calculate delivery charge before checkout ─────────────────────────
// POST /api/delivery-charge/calculate
// Body: { vendorId, userLat, userLng } OR { vendorId, addressId }
export const calculateDeliveryFee = async (req, res) => {
    try {
        const { vendorId, userLat, userLng, addressId } = req.body;
        const userId = req.userId;

        if (!vendorId) {
            return res.status(400).json({ success: false, message: "vendorId is required" });
        }

        const vendor = await User.findById(vendorId).select("businessDetails.location deliveryChargePermission retailerDeliverySlabs");
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

        let destLat = userLat;
        let destLng = userLng;

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

        const distanceKm = await calculateDistanceKm(
            vendorCoords.lat,
            vendorCoords.lng,
            parseFloat(destLat),
            parseFloat(destLng)
        );

        const globalSetting = await getDeliveryChargeSetting();
        let slabsToUse = globalSetting.slabs;
        let chargeOwner = "retailer"; // delivery income always goes to the retailer

        if (vendor.deliveryChargePermission && vendor.retailerDeliverySlabs && vendor.retailerDeliverySlabs.length > 0) {
            slabsToUse = vendor.retailerDeliverySlabs;
        }

        const { charge, slab, deliverable } = resolveDeliveryCharge(distanceKm, { ...globalSetting.toObject(), slabs: slabsToUse });

        if (!deliverable) {
            return res.status(200).json({
                success: true,
                deliverable: false,
                distanceKm,
                maxDeliveryKm: globalSetting.maxDeliveryKm,
                message: `Sorry, delivery is not available beyond ${globalSetting.maxDeliveryKm} km. Your distance is ${distanceKm} km.`
            });
        }

        return res.status(200).json({
            success: true,
            deliverable: true,
            distanceKm,
            deliveryFee: charge,
            isFreeDelivery: charge === 0,
            chargeOwner,
            slab: { from: slab.minKm, to: slab.maxKm, charge: slab.charge },
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
export const getDeliveryIncomeReport = async (req, res) => {
    try {
        const { page = 1, limit = 20, from, to } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

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
            .populate("items.retailer", "name businessDetails.businessName deliveryChargePermission")
            .select("orderId totalAmount deliveryFee distance commissionAmount commissionRate createdAt status paymentMethod")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const totalCount = await Order.countDocuments(query);

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
                    totalPlatformIncome: summary.totalCommissionIncome
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

// ─── RETAILER: Get their own delivery income ──────────────────────────────
// GET /api/retailer/delivery-income
export const getRetailerDeliveryIncome = async (req, res) => {
    try {
        const retailerId = req.user.id;
        const retailer = await User.findById(retailerId);
        if (!retailer) {
            return res.status(200).json({ success: true, data: { totalDeliveryIncome: 0, totalOrders: 0, orders: [] } });
        }

        const orders = await Order.find({
            "items.retailer": retailerId,
            status: { $in: ["Delivered", "Completed"] },
            deliveryFee: { $gt: 0 }
        }).select("orderId totalAmount deliveryFee createdAt").sort({ createdAt: -1 }).limit(50);

        const totalDeliveryIncome = orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

        res.status(200).json({
            success: true,
            data: { totalDeliveryIncome, totalOrders: orders.length, orders }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
