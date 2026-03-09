import AppUser from "../models/AppUser.js";
import { adjustBalance } from "./walletService.js";

/**
 * Generates a unique referral code for a new user
 */
export const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * Rewards the referrer and referred user after the referred user completes their first week
 * This should be triggered by the subscription engine after 7 successful daily orders.
 */
export const rewardReferral = async (userId) => {
    try {
        const user = await AppUser.findById(userId);
        if (!user || !user.referredBy) return;

        const referrerId = user.referredBy;
        const REWARD_AMOUNT = 50; // ₹50 reward

        // Credit Referrer
        await adjustBalance(referrerId, 'customer', REWARD_AMOUNT, 'credit', `Referral Reward for ${user.phoneNumber}`);

        // Credit Referred User
        await adjustBalance(userId, 'customer', REWARD_AMOUNT, 'credit', 'Signup Referral Reward');

        console.log(`Referral rewards processed for User: ${userId} and Referrer: ${referrerId}`);
    } catch (error) {
        console.error("Referral Reward Error:", error);
    }
};
