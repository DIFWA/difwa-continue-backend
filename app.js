import express from "express"
import cors from "cors"
import "./config/firebase.js"
import path from "path"
import authRoutes from "./routes/authRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"
import appAuthRoutes from "./routes/appAuthRoutes.js";
import retailerRoutes from "./routes/retailerRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import communicationRoutes from "./routes/communicationRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import cronRoutes from "./routes/cronRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import commissionRoutes from "./routes/commissionRoutes.js";
import appSupportRoutes from "./routes/appSupportRoutes.js";
import appNotificationRoutes from "./routes/appNotificationRoutes.js";
import faqRoutes from "./routes/faqRoutes.js";
import deliveryChargeRoutes from "./routes/deliveryChargeRoutes.js";
import Faq from "./models/Faq.js";
const app = express()

// Trust proxy for ngrok/vercel
app.set('trust proxy', 1);

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Origin");

    // Handle Preflight
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});


app.use(express.json())
app.use(express.urlencoded({ extended: true }));

import connectDB from "./config/db.js"
app.use(async (req, res, next) => {

    if (req.method === "OPTIONS") {
        return next();
    }

    try {
        await connectDB();
        next();
    } catch (err) {
        console.error("DB Connection Error:", err.message);
        res.status(500).json({ success: false, message: "Database connection failed" });
    }
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/retailer", retailerRoutes)
app.use("/api/otp", otpRoutes);
app.use("/api/app", appAuthRoutes);
app.use("/app", appAuthRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/wallet", walletRoutes);

app.use("/api/subscription", subscriptionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/app/orders", orderRoutes);
app.use("/app/orders", orderRoutes);
app.use("/orders", orderRoutes);

app.use("/api/payment", paymentRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/api/app/favorites", favoriteRoutes);
app.use("/app/favorites", favoriteRoutes);

app.use("/api/app/search", searchRoutes);
app.use("/app/search", searchRoutes);

app.use("/api/app/support", appSupportRoutes);
app.use("/api/app/notifications", appNotificationRoutes);
app.use("/api/faq", faqRoutes);

app.use("/api/commission", commissionRoutes);
app.use("/api/delivery-charge", deliveryChargeRoutes);

// Seed Check
const seedIfEmpty = async () => {
    try {
        const count = await Faq.countDocuments();
        if (count === 0) {
            const initialFaqs = [
                { question: "How do I pause my subscription?", answer: "Go to the 'Daily' or 'Subscriptions' tab, tap on 'Pause Tomorrow' or enable 'Vacation Mode' for a range of dates.", order: 1 },
                { question: "What is the cutoff time for changes?", answer: "All changes to your subscription (pausing, resuming, or modifying) must be done before 8:00 PM for the next day's delivery.", order: 2 },
                { question: "How do I add money to my wallet?", answer: "Open 'My Wallet' from the profile or home screen, tap 'Add Money', enter the amount, and complete the payment via Razorpay.", order: 3 },
                { question: "Can I cancel an order?", answer: "Orders can only be cancelled before they are in 'Processing' status.", order: 4 },
                { question: "My delivery is late, whom should I contact?", answer: "Use the 'Contact Us' form to reach admin.", order: 5 },
                { question: "Is the water tested and pure?", answer: "Yes, all our partner water plants are certified.", order: 6 }
            ];
            await Faq.insertMany(initialFaqs);
            console.log("✅ FAQs seeded automatically");
        }
    } catch (err) { }
};
seedIfEmpty();

// Basic test route
app.get("/", (req, res) => {
    res.send("Difwa Backend Running ")
})

export default app