import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    silverPrice: {
        type: Number,
        required: true
    },
    goldPrice: {
        type: Number,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    images: [{
        type: String // Cloudinary URLs
    }],
    stock: {
        type: Number,
        default: 0
    },
    stockStatus: {
        type: String,
        enum: ["In Stock", "Out of Stock", "Low Stock"],
        default: "In Stock"
    },
    sku: {
        type: String,
        unique: true
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Assuming User model is used for Retailers too, or I should check Retailer model if any
        required: true
    },
    status: {
        type: String,
        enum: ["Published", "Draft", "Archived"],
        default: "Published"
    }
}, { timestamps: true });

export default mongoose.model("Product", ProductSchema);
