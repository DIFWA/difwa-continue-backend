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
export const emitOrderUpdate = async (orderId, status, data, retailerId = null, userId = null) => {
    const rooms = [`order_${orderId}`];
    if (retailerId) rooms.push(`retailer_${retailerId}`);
    if (userId) rooms.push(`user_${userId}`);

    const payload = { status, data, orderId };

    // 1. Try local emit
    if (io) {
        rooms.forEach(room => {
            io.to(room).emit("orderUpdate", payload);
        });
    }

    // 2. Try relay emit (for Vercel)
    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        try {
            for (const room of rooms) {
                await fetch(`${relayUrl}/emit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                        event: "orderUpdate",
                        room: room,
                        data: payload
                    })
                });
            }
        } catch (error) {
            console.error("Relay emit failed:", error.message);
        }
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
