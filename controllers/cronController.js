import { generateDailyOrders } from "../services/subscriptionService.js";

export const runDailySubscriptionCron = async (req, res) => {
    try {

        if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
            return res.status(403).json({ message: "Unauthorized cron access" });
        }

        console.log("Cron job started: generating subscription orders");

        const stats = await generateDailyOrders();

        res.status(200).json({
            success: true,
            message: "Subscription orders generated successfully",
            stats
        });

    } catch (error) {

        console.error("Cron job failed:", error);

        res.status(500).json({
            success: false,
            message: "Cron job failed",
            error: error.message
        });

    }
};