import express from "express";
import { contactAdmin, getSupportRequests } from "../controllers/appSupportController.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

router.post("/contact", protectAppUser, contactAdmin);
router.get("/requests", protectAppUser, getSupportRequests);

export default router;
