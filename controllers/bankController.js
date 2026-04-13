import BankAccount from "../models/BankAccount.js";

export const getBankAccounts = async (req, res) => {
    try {
        const retailerId = req.user.id || req.user._id || req.userId;
        const accounts = await BankAccount.find({ retailer: retailerId }).sort({ isDefault: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: accounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addBankAccount = async (req, res) => {
    try {
        const retailerId = req.user.id || req.user._id || req.userId;
        const { bankName, accountHolderName, accountNumber, ifscCode, accountType, isDefault } = req.body;

        if (isDefault) {
            await BankAccount.updateMany({ retailer: retailerId }, { isDefault: false });
        }

        const newAccount = await BankAccount.create({
            retailer: retailerId,
            bankName,
            accountHolderName,
            accountNumber,
            ifscCode,
            accountType,
            isDefault
        });

        res.status(201).json({ success: true, data: newAccount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteBankAccount = async (req, res) => {
    try {
        const retailerId = req.user.id || req.user._id || req.userId;
        const account = await BankAccount.findOneAndDelete({ _id: req.params.id, retailer: retailerId });
        
        if (!account) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }

        res.status(200).json({ success: true, message: "Bank account removed successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const setDefaultBankAccount = async (req, res) => {
    try {
        const retailerId = req.user.id || req.user._id || req.userId;
        
        await BankAccount.updateMany({ retailer: retailerId }, { isDefault: false });
        const account = await BankAccount.findOneAndUpdate(
            { _id: req.params.id, retailer: retailerId },
            { isDefault: true },
            { new: true }
        );

        if (!account) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }

        res.status(200).json({ success: true, data: account });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
