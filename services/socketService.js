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

// ─── Emitters ─────────────────────────────────────────────────────────────────
export const emitOrderUpdate = (orderId, status, data) => {
    _log("EMIT → orderUpdate", { data: { room: orderId, status, data } });
    io.to(orderId).emit("orderUpdate", { status, data });
};

export const emitChatUpdate = (chatId, message) => {
    _log("EMIT → newMessage", { data: { room: chatId, message } });
    io.to(chatId).emit("newMessage", message);
};
