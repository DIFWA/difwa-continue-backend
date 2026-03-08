import express from "express";
import { createChat, sendMessage, getMyChats } from "../controllers/chatController.js";
// import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", createChat);
router.post("/send", sendMessage);
router.get("/my", getMyChats);

export default router;
