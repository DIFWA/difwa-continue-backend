import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    frequency: {
        type: String,
        enum: ["Daily", "Alternate Days", "Weekly"],
        required: true
    },
    customDays: {
        type: [String], // ["Monday", "Wednesday", "Friday"]
        default: []
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ["Active", "Paused", "Cancelled"],
        default: "Active"
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: Date,
    vacationDates: [Date], // Dates to skip
    lastGeneratedDate: Date // To prevent double generation
}, { timestamps: true });

export default mongoose.model("Subscription", subscriptionSchema);
