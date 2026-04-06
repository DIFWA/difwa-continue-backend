import { Server } from "socket.io";

let io;

// ─── Structured Logger ────────────────────────────────────────────────────────
const _log = (title, { data, status } = {}) => {
    const tag = status ? `[${status}] ` : "";
    console.log("");
    console.log(`┌─── SOCKET ${tag}${"─".repeat(Math.max(0, 32 - tag.length))}`);
    console.log(`│ ${title}`);
    if (data !== undefined) console.log(`│ Data:`, data);
    console.log(`└${"─".repeat(44)}`);
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export const initSocket = (server) => {
    _log("Socket.IO Initializing...");

    io = new Server(server, {
        cors: {
            origin: "*", // Adjust for production
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        _log("Client Connected", { data: socket.id, status: "SUCCESS" });

        // Joining a room for hardware updates
        socket.on("join-hardware-room", (deviceId) => {
            socket.join(`device_${deviceId}`);
            _log("Client Joined Hardware Room", { data: { socketId: socket.id, deviceId } });
        });

        // ─── Hardware -> Server Data ──────────────────────────────────────────
        socket.on("hardware:level-update", async (data) => {
            const { deviceId, level } = data;
            _log("Hardware Data Received", { data: { deviceId, level }, status: "INFO" });

            // Relay to all Web UI clients in the room
            io.to(`device_${deviceId}`).emit("hardware:level-update", { level });

            // Optionally update database in the background
            try {
                // If automation is on, you could trigger a toggle event here
                // We'll keep it simple for now and just relay
            } catch (err) {
                console.error("Hardware update sync failed:", err.message);
            }
        });

        // ─── Web UI -> Server Command ─────────────────────────────────────────
        socket.on("commands:toggle-pump", (data) => {
            const { deviceId, status } = data;
            _log("Pump Command Received", { data: { deviceId, status }, status: "WARNING" });

            // Forward to the hardware device
            // The ESP8266 should be listening for 'commands:toggle-pump'
            io.to(`device_${deviceId}`).emit("commands:toggle-pump", { status });
        });

        // ─── Hardware -> Server Status Confirmation ───────────────────────────
        socket.on("hardware:pump-confirm", (data) => {
            const { deviceId, status } = data;
            _log("Hardware Status Confirmed", { data: { deviceId, status }, status: "SUCCESS" });

            // Relay to Web UI
            io.to(`device_${deviceId}`).emit("hardware:pump-status", { status });
        });

        socket.on("join", (room) => {
            socket.join(room);
            _log("Client Joined Room", { data: { socketId: socket.id, room } });
        });

        socket.on("leave", (room) => {
            socket.leave(room);
            _log("Client Left Room", { data: { socketId: socket.id, room } });
        });

        socket.on("disconnect", (reason) => {
            _log("Client Disconnected", { data: { socketId: socket.id, reason }, status: "WARNING" });
        });

        socket.on("error", (err) => {
            _log("Socket Error", { data: err, status: "ERROR" });
        });
    });

    _log("Socket.IO Ready", { status: "SUCCESS" });
    return io;
};

// ─── Getter ───────────────────────────────────────────────────────────────────
export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// Simplified emitters for common events
export const emitOrderUpdate = async (orderId, status, data, retailerId = null, userId = null, riderId = null) => {
    // 1. Determine all possible order rooms
    const rooms = [`order_${orderId}`, "admin"];
    
    // Add Mongo ID room if available (handles cases where client joins using database ID)
    const mongoId = data?._id || data?.order?._id;
    if (mongoId && mongoId.toString() !== orderId.toString()) {
        rooms.push(`order_${mongoId.toString()}`);
    }

    if (retailerId) rooms.push(`retailer_${retailerId.toString()}`);
    if (userId) rooms.push(`user_${userId.toString()}`);
    if (riderId) rooms.push(`rider_${riderId.toString()}`);

    const payload = { status, data, orderId };
    
    // Specifically trigger NEW_ORDER for admins and the specific retailer on initial 'Pending' creation
    if (status === "Pending" && io) {
        io.to("admin").emit("NEW_ORDER", payload);
        io.emit("NEW_ORDER_ALL", payload); // Broadcast for redundancy
        if (retailerId) {
            io.to(`retailer_${retailerId.toString()}`).emit("NEW_ORDER", payload);
            io.to(`user_${retailerId.toString()}`).emit("NEW_ORDER", payload);
        }
    }
    
    // 1. Local emit - DO THIS FIRST to ensure immediate local feedback
    if (io) {
        _log(`Emitting locally to ${rooms.length} rooms`, { status: "INFO", data: rooms });
        rooms.forEach(room => {
            io.to(room).emit("orderUpdate", payload);
        });
    }

    // 2. Relay emit (for Vercel/External Dashboards)
    // We do NOT await this anymore to keep the API responsive
    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        Promise.all(rooms.map(room => 
            fetch(`${relayUrl}/emit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                    event: "orderUpdate",
                    room: room,
                    data: payload
                })
            })
        )).catch(error => {
            console.error("Relay emit background failed:", error.message);
        });
    }
};

// Emit rider assignment to the user — triggers popup + sound in user app
export const emitRiderAssigned = async (orderId, userId, riderInfo) => {
    const room = `user_${userId}`;
    const payload = { orderId, rider: riderInfo };

    _log("Emitting riderAssigned", { data: { room, orderId } });

    if (io) {
        io.to(room).emit("riderAssigned", payload);
    }

    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        try {
            await fetch(`${relayUrl}/emit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                    event: "riderAssigned",
                    room: room,
                    data: payload
                })
            });
        } catch (error) {
            console.error("Relay riderAssigned emit failed:", error.message);
        }
    }
};

export const emitChatUpdate = async (chatId, message) => {
    const room = `chat_${chatId}`;
    // 1. Try local emit
    if (io) {
        io.to(room).emit("newMessage", message);
    }

    // 2. Try relay emit (for Vercel)
    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        try {
            await fetch(`${relayUrl}/emit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                    event: "newMessage",
                    room: room,
                    data: message
                })
            });
        } catch (error) {
            console.error("Relay chat emit failed:", error.message);
        }
    }
};

export const emitNotification = async (recipientId, notification) => {
    const room = `retailer_notifications_${recipientId}`;
    const payload = { ...notification, createdAt: new Date() };

    _log("Emitting Notification", { data: { room, title: notification.title } });

    if (io) {
        io.to(room).emit("notification", payload);
    }

    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        try {
            await fetch(`${relayUrl}/emit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                    event: "notification",
                    room: room,
                    data: payload
                })
            });
        } catch (error) {
            console.error("Relay notification emit failed:", error.message);
        }
    }
};


export const emitShopStatusUpdate = (shopId, isShopActive) => {
    const payload = { shopId, isShopActive };
    _log("Emitting Shop Status Update", { data: payload });

    if (io) {
        io.emit("shopStatusUpdate", payload);
    }

    // Relay for Vercel if needed
    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        fetch(`${relayUrl}/emit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                event: "shopStatusUpdate",
                broadcast: true,
                data: payload
            })
        }).catch(err => console.error("Relay shop status update failed:", err.message));
    }
};

// ─── Product Update Emitter ───────────────────────────────────────────────────
export const emitProductUpdate = (action, product, retailerId) => {
    if (!retailerId) return;

    const room = `retailer_${retailerId.toString()}`;
    const payload = { action, product }; // action: 'created' | 'updated' | 'deleted'

    _log(`Emitting productUpdate [${action}]`, { data: { room, productId: product?._id } });

    if (io) {
        io.to(room).emit("productUpdate", payload);
    }

    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        fetch(`${relayUrl}/emit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                event: "productUpdate",
                room,
                data: payload
            })
        }).catch(err => console.error("Relay productUpdate emit failed:", err.message));
    }
};
