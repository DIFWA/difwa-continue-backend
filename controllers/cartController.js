import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

export const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.userId;

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({
                user: userId,
                retailer: product.retailer,
                items: []
            });
        }

        // Prevent multi-shop cart
        if (cart.retailer && cart.retailer.toString() !== product.retailer.toString()) {
            return res.status(400).json({
                message: "Cart already contains items from another shop"
            });
        }

        const existingItem = cart.items.find(
            item => item.product.toString() === productId
        );

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    message: `Only ${product.stock}kg available in stock`
                });
            }
            existingItem.quantity = newQuantity;
        } else {
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `Only ${product.stock}kg available in stock`
                });
            }
            cart.items.push({
                product: productId,
                quantity,
                price: product.price
            });
        }

        // Remove if quantity = 0
        cart.items = cart.items.filter(item => item.quantity > 0);
        // If cart becomes empty, reset retailer
        if (cart.items.length === 0) {
            cart.retailer = null;
        }
        await cart.save();

        res.json({
            success: true,
            cart
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const getCart = async (req, res) => {
    try {

        const cart = await Cart.findOne({ user: req.userId })
            .populate("items.product");

        res.json({
            success: true,
            cart
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const clearCart = async (req, res) => {
    try {

        await Cart.findOneAndDelete({ user: req.userId });

        res.json({
            success: true,
            message: "Cart cleared"
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};