import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req, res) => {
    try {
        const { product: productId, retailer: retailerId, rating, comment, tags } = req.body;
        const userId = req.user._id;

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Optional: Check if the user has actually ordered this product
        // We will skip this strict check for simplicity unless required, or we can check:
        /*
        const hasOrdered = await Order.findOne({
            user: userId,
            "items.product": productId,
            status: { $in: ["Delivered", "Completed"] }
        });
        if (!hasOrdered) {
            return res.status(400).json({ success: false, message: "You can only review products you have purchased" });
        }
        */

        // Check if user already reviewed this product
        const alreadyReviewed = await Review.findOne({ user: userId, product: productId });
        if (alreadyReviewed) {
            return res.status(400).json({ success: false, message: "Product already reviewed" });
        }

        const review = await Review.create({
            user: userId,
            product: productId,
            retailer: retailerId || product.retailer,
            rating: Number(rating),
            comment,
            tags: tags || []
        });

        res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            data: review
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/:productId
// @access  Public
export const getProductReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ product: req.params.productId })
            .populate("user", "name")
            .sort("-createdAt");

        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
