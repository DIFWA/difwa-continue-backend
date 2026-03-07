import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    price: {
        type: Number,
        required: true
    }
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true,
        unique: true
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    items: [cartItemSchema]
}, { timestamps: true });

export default mongoose.model("Cart", cartSchema);