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
const app = express()


// Middleware
const allowedOrigins = [
    "https://difwa-frontend.vercel.app",
    "http://localhost:3000", 
    "http://localhost:3001",
    "http://localhost:5000"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json())
app.use(express.urlencoded({ extended: true }));
// Connect to Database per request (more reliable for Vercel serverless)
import connectDB from "./config/db.js"
app.use(async (req, res, next) => {
    // Skip DB connection for preflight requests to avoid timeouts/CORS errors
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

// App Routes (supporting both /api/app and /app)
app.use("/api/app", appAuthRoutes);
app.use("/app", appAuthRoutes);

// Wallet Routes (supporting both /api/wallet and /wallet)
app.use("/api/wallet", walletRoutes);
app.use("/wallet", walletRoutes);

app.use("/api/subscription", subscriptionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/app/orders", orderRoutes);
app.use("/orders", orderRoutes); // Added for consistency if needed

app.use("/api/payment", paymentRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/app/favorites", favoriteRoutes);
app.use("/api/app/search", searchRoutes);

// Basic test route
app.get("/", (req, res) => {
    res.send("Difwa Backend Running ")
})

export default app