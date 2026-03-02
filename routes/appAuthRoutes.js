import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    addAddress,
    getAddresses,
    deleteAddress
} from "../controllers/appAuthController.js";

//register

router.post("/register", registerUser);

//login
router.post("/login", loginUser);

//get profile
router.get("/profile", protectAppUser, getProfile);

//update profile
router.put("/profile", protectAppUser, updateProfile);

//change password
router.put("/change-password", protectAppUser, changePassword);

//forgot password
router.post("/forgot-password", forgotPassword);

//add address
router.post("/addaddress", protectAppUser, addAddress);

//get addresses
router.get("/address", protectAppUser, getAddresses);

//delete address
router.delete("/address/:id", protectAppUser, deleteAddress);

export default router;