import User from "../models/User.js";
import Product from "../models/Product.js";

/**
 * @desc    Global Search for shops and products
 * @route   GET /api/app/search
 * @access  Public
 */
export const globalSearch = async (req, res) => {
    try {
        const { query = "" } = req.query;

        if (!query || query.trim().length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    shops: [],
                    products: []
                }
            });
        }

        const searchRegex = new RegExp(query, "i");

        // 1. Search for Retailers (Shops)
        // Only approved retailers who have shops
        const shops = await User.find({
            role: "retailer",
            status: "approved",
            $or: [
                { "businessDetails.businessName": searchRegex },
                { "businessDetails.storeDisplayName": searchRegex }
            ]
        })
        .select("name email businessDetails isShopActive")
        .limit(10);

        const formattedShops = shops.map(shop => ({
            id: shop._id,
            name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
            businessName: shop.businessDetails?.businessName,
            image: shop.businessDetails?.storeImage || "",
            location: shop.businessDetails?.location?.city || "",
            isShopActive: shop.isShopActive ?? true,
            rating: 4.5,
            deliveryTime: "30-45 mins"
        }));

        // 2. Search for Products
        // Only published products
        const products = await Product.find({
            status: "Published",
            $or: [
                { name: searchRegex },
                { description: searchRegex }
            ]
        })
        .populate({
            path: "retailer",
            select: "businessDetails.storeDisplayName businessDetails.businessName name"
        })
        .limit(20);

        const formattedProducts = products.map(product => ({
            id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "",
            description: product.description,
            stockStatus: product.stockStatus,
            shop: {
                id: product.retailer?._id,
                name: product.retailer?.businessDetails?.storeDisplayName || product.retailer?.businessDetails?.businessName || product.retailer?.name || "Unknown Shop"
            }
        }));

        res.status(200).json({
            success: true,
            data: {
                shops: formattedShops,
                products: formattedProducts
            }
        });

    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error in Search API"
        });
    }
};

/**
 * @desc    Get filtered products (Global)
 * @route   GET /api/app/search/products
 * @access  Public
 */
export const getFilteredProducts = async (req, res) => {
    try {
        const { 
            category, 
            minPrice, 
            maxPrice, 
            search, 
            page = 1, 
            limit = 20 
        } = req.query;

        const filterObj = { status: "Published" };

        // 1. Category Filter (supports single ID or comma-separated string)
        if (category) {
            if (category.includes(',')) {
                filterObj.category = { $in: category.split(',') };
            } else {
                filterObj.category = category;
            }
        }

        // 2. Price Range Filter
        if (minPrice || maxPrice) {
            filterObj.price = {};
            if (minPrice) filterObj.price.$gte = Number(minPrice);
            if (maxPrice) filterObj.price.$lte = Number(maxPrice);
        }

        // 3. Search Query
        if (search) {
            filterObj.$or = [
                { name: new RegExp(search, "i") },
                { description: new RegExp(search, "i") }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await Product.find(filterObj)
            .populate({
                path: "retailer",
                select: "businessDetails.storeDisplayName businessDetails.businessName name"
            })
            .populate("category", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalItems = await Product.countDocuments(filterObj);

        const formattedProducts = products.map(product => ({
            id: product._id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || "",
            description: product.description,
            stockStatus: product.stockStatus,
            category: {
                id: product.category?._id,
                name: product.category?.name
            },
            shop: {
                id: product.retailer?._id,
                name: product.retailer?.businessDetails?.storeDisplayName || product.retailer?.businessDetails?.businessName || product.retailer?.name || "Unknown Shop"
            }
        }));

        res.status(200).json({
            success: true,
            data: {
                products: formattedProducts,
                pagination: {
                    totalItems,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalItems / limit)
                }
            }
        });

    } catch (error) {
        console.error("Filtered Products Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error in Filtered Products API"
        });
    }
};
