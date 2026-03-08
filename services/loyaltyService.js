import AppUser from "../models/AppUser.js";

/**
 * Calculates and awards loyalty points based on order total
 * Conversion: ₹10 = 1 Point
 */
export const awardLoyaltyPoints = async (userId, orderTotal) => {
    try {
        const points = Math.floor(orderTotal / 10);
        if (points === 0) return;

        // In a real app, you'd add a 'loyaltyPoints' field to the AppUser model
        // For now, using wallet balance as a proxy or just logging
        console.log(`Awarding ${points} loyalty points to User: ${userId}`);

        // await AppUser.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: points } });
    } catch (error) {
        console.error("Loyalty Points Error:", error);
    }
};

/**
 * Redeems loyalty points for wallet balance
 */
export const redeemPoints = async (userId, points) => {
    // Logic to convert points back to wallet balance
    const CONVERSION_RATE = 0.5; // 1 Point = ₹0.50
    const creditAmount = points * CONVERSION_RATE;
    // await adjustBalance(userId, 'customer', creditAmount, 'credit', 'Loyalty Points Redemption');
    return creditAmount;
};
