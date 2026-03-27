import Order from "../models/Order.js";
import AppUser from "../models/AppUser.js";
import Product from "../models/Product.js";

/**
 * @desc    Global Search for Retailer Console
 * @route   GET /api/retailer/search
 * @access  Private (Retailer Only)
 */
export const searchAnything = async (req, res) => {
    try {
        const { q = "" } = req.query;
        const retailerId = req.user._id;

        if (!q || q.trim().length < 2) {
            return res.status(200).json({
                success: true,
                data: { orders: [], customers: [], products: [] }
            });
        }

        const searchRegex = new RegExp(q, "i");

        // 1. Search Orders (by OrderId or Customer Name)
        const orders = await Order.find({
            "items.retailer": retailerId,
            $or: [
                { orderId: searchRegex },
                { "user.fullName": searchRegex }
            ]
        })
        .populate("user", "fullName phoneNumber email")
        .limit(5)
        .sort({ createdAt: -1 });

        // 2. Search Customers (AppUser)
        // Search among customers who have ordered from this retailer or were added by this retailer
        // For now, simpler: search all AppUsers matching the query (or limit to those with retailer relationship)
        const customers = await AppUser.find({
            $or: [
                { fullName: searchRegex },
                { phoneNumber: searchRegex },
                { email: searchRegex }
            ],
            $or: [
                { addedByRetailer: retailerId },
                { "retailerBalances.retailer": retailerId }
            ]
        })
        .select("fullName phoneNumber email profilePicture isManual")
        .limit(5);

        // 3. Search Products (Retailer's own products)
        const products = await Product.find({
            retailer: retailerId,
            name: searchRegex
        })
        .limit(5);

        res.status(200).json({
            success: true,
            data: {
                orders: orders.map(o => ({
                    id: o._id,
                    orderId: o.orderId,
                    customer: o.user?.fullName || "Guest",
                    total: o.totalAmount,
                    status: o.status,
                    date: o.createdAt
                })),
                customers: customers.map(c => ({
                    id: c._id,
                    name: c.fullName,
                    phone: c.phoneNumber,
                    email: c.email,
                    image: c.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.fullName.replace(/\s+/g, '')}`,
                    isManual: c.isManual
                })),
                products: products.map(p => ({
                    id: p._id,
                    name: p.name,
                    price: p.price,
                    image: p.images?.[0] || "",
                    stockStatus: p.stockStatus
                }))
            }
        });

    } catch (error) {
        console.error("Retailer Search Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error in Search API"
        });
    }
};
