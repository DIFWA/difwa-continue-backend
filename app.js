import express from "express"
import cors from "cors"
import path from "path"
import authRoutes from "./routes/authRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"
import appAuthRoutes from "./routes/appAuthRoutes.js";
import retailerRoutes from "./routes/retailerRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";

const app = express()

// Connect Database
import connectDB from "./config/db.js"
await connectDB()

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

// Basic test route
app.get("/", (req, res) => {
    res.send("Shrimpbite Backend Running 🦐")
})

export default app
