import Transaction from "../models/Transaction.js";
import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import mongoose from "mongoose";

export const adjustBalance = async (userId, userType, amount, type, description, source, referenceId = null, existingSession = null) => {
    const session = existingSession || await mongoose.startSession();
    if (!existingSession) session.startTransaction();

    try {
        const Model = userType === "appUser" ? AppUser : User;
        const user = await Model.findById(userId).session(session);

        if (!user) throw new Error("User not found");

        if (type === "Debit" && user.walletBalance < amount) {
            throw new Error("Insufficient wallet balance");
        }

        const newBalance = type === "Credit"
            ? user.walletBalance + amount
            : (user.walletBalance || 0) - amount;

        user.walletBalance = newBalance;
        await user.save({ session });

        const transaction = await Transaction.create([{
            user: userId,
            amount,
            type,
            description,
            source,
            referenceId,
            status: "Success"
        }], { session });

        if (!existingSession) await session.commitTransaction();
        return { success: true, newBalance, transaction: transaction[0] };
    } catch (error) {
        if (!existingSession) await session.abortTransaction();
        throw error;
    } finally {
        if (!existingSession) session.endSession();
    }
};

export const getHistory = async (userId) => {
    return await Transaction.find({ user: userId }).sort({ createdAt: -1 });
};
