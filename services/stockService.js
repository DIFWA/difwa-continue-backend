import Product from "../models/Product.js";
import User from "../models/User.js";
import { createNotification } from "./notificationService.js";
import { sendLowStockEmail } from "./emailService.js";

/**
 * Checks a product's stock and sends an email/notification if it crosses below the low stock threshold (10).
 * It updates the stockStatus to "Low Stock" or "Out of Stock" accordingly to prevent duplicate notifications.
 */
export const checkAndNotifyLowStock = async (productId) => {
    try {
        const product = await Product.findById(productId).populate('retailer');
        if (!product || !product.retailer) return;

        const stock = product.stock;
        
        let newStockStatus = product.stockStatus;
        if (stock <= 0) {
            newStockStatus = "Out of Stock";
        } else if (stock < 10) {
            newStockStatus = "Low Stock";
        } else {
            newStockStatus = "In Stock";
        }

        // If the status changed to Low Stock or Out of Stock, trigger the alerts
        // Only trigger if it wasn't already in that specific status
        if (newStockStatus !== product.stockStatus && (newStockStatus === "Low Stock" || newStockStatus === "Out of Stock")) {
            
            // 1. Send Notification to Retailer App
            createNotification(product.retailer._id.toString(), {
                title: newStockStatus === "Out of Stock" ? "🚨 Out of Stock!" : "⚠️ Low Stock Alert",
                message: `Your product "${product.name}" has ${stock} units remaining.`,
                type: "Inventory"
            });

            // 2. Send Email
            if (product.retailer.email) {
                 sendLowStockEmail(product.retailer.email, product.name, stock);
            }
        }

        // Always update the status in the DB if it changed
        if (newStockStatus !== product.stockStatus) {
            product.stockStatus = newStockStatus;
            await product.save();
        }

    } catch (error) {
        console.error("Error checking low stock:", error);
    }
};
