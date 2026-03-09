import cron from "node-cron";
import { generateDailyOrders } from "./services/subscriptionService.js";

// Schedule to run at 12:01 AM every day
// Seconds Minutes Hours DayOfMonth Month DayOfWeek
export const initCronJobs = () => {
    if (process.env.ENABLE_LOCAL_CRON !== "true") {
        console.log("Local Cron Jobs Disabled (ENABLE_LOCAL_CRON is not true) ⏩");
        return;
    }

    cron.schedule("1 0 * * *", async () => {
        console.log("Running Daily Subscription Order Generation... 🕒");
        try {
            const stats = await generateDailyOrders();
            console.log(`Daily Generation Complete: Created ${stats.created}, Skipped ${stats.skipped}, Failed ${stats.failed}`);
        } catch (error) {
            console.error("Cron Job Failed: Critical Error during Daily Generation:", error);
        }
    });

    console.log("Subscription Cron Jobs Initialized ✅");
};
