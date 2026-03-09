import express from "express"
import cors from "cors"
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

const app = express()


// Middleware
app.use(cors())
app.use(express.json())
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/retailer", retailerRoutes)
app.use("/api/otp", otpRoutes);
//app routes

app.use("/api/app", appAuthRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/app/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);

// Basic test route
app.get("/", (req, res) => {
    res.send("Shrimpbite Backend Running 🦐")
})

export default app
