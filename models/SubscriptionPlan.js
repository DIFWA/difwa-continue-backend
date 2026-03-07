import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
            default: 0,
        },
        billingCycle: {
            type: String,
            enum: ["Monthly", "Yearly", "Lifetime"],
            required: true,
        },
        features: [
            {
                type: String,
            }
        ],
        maxOrderQuantity: {
            type: Number, // kg
            required: true,
        },
        discountPercentage: {
            type: Number,
            default: 0,
        },
        bulkOrdersAllowed: {
            type: Boolean,
            default: false,
        },
        freeDeliveries: {
            type: Number, // per week or total? Let's say count
            default: 0,
        },
        priorityDelivery: {
            type: Boolean,
            default: false,
        },
        badge: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["Active", "Disabled"],
            default: "Active",
        },
    },
    { timestamps: true }
);

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
