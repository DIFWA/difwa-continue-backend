
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000"; // Update if needed

console.log(`📡 Connecting to Socket at ${SOCKET_URL}...`);

const socket = io(SOCKET_URL);

socket.on("connect", () => {
    console.log("✅ Connected to Socket Server!");
    console.log("⏳ Listening for 'shopStatusUpdate' events...");
    console.log("TIP: Go to your Retailer Dashboard and toggle the 'Live Availability' button.");
});

socket.on("shopStatusUpdate", (data) => {
    console.log("\n⚡ RECEVIED EVENT: shopStatusUpdate");
    console.log("Data:", JSON.stringify(data, null, 2));
    if (data.isShopActive === undefined) {
        console.log("⚠️ ERROR: Received undefined isShopActive!");
    } else {
        console.log(`Status is now: ${data.isShopActive ? "OPEN" : "CLOSED"}`);
    }
});

socket.on("connect_error", (err) => {
    console.log("❌ Connection Error:", err.message);
});

// Keep process running
setTimeout(() => {
    console.log("\nTimeout reached (60s). diagnostic script closing.");
    process.exit(0);
}, 60000);
