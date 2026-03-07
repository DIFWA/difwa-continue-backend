import dotenv from "dotenv"
dotenv.config()

import app from "./app.js"
import connectDB from "./config/db.js"
import paymentRoutes from "./routes/paymentRoutes.js";


// Connect DB
await connectDB()

// Register routes
app.use("/api/payment", paymentRoutes)

// Start Server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})