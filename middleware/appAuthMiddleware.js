import jwt from "jsonwebtoken";
import AppUser from "../models/AppUser.js";

const protectAppUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Not authorized" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let user;

        if (decoded.role === "rider") {
            const Rider = (await import("../models/User.js")).default;
            user = await Rider.findById(decoded.id).select("-password");
            if (user) user = { ...user.toObject(), role: "rider", id: user._id.toString() };
        } else {
            user = await AppUser.findById(decoded.id).select("-password");
            if (user) user = { ...user.toObject(), role: "customer", id: user._id.toString() };
        }

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = user;
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalid" });
    }
};

export default protectAppUser;