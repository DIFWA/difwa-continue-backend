import Role from "../models/Role.js";

export const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "User not authenticated" });
            }

            // Super admin bypass (optional, if you have a way to identify super admins)
            if (req.user.role === "admin" && !req.user.roleId) {
                // If it's the main admin with no roleId, allow everything or handle separately
                return next();
            }

            if (!req.user.roleId) {
                return res.status(403).json({ message: "No role assigned. Access denied." });
            }

            const role = await Role.findById(req.user.roleId);
            if (!role) {
                return res.status(403).json({ message: "Role not found. Access denied." });
            }

            if (role.permissions.includes(requiredPermission)) {
                return next();
            }

            res.status(403).json({ message: "Permission denied: " + requiredPermission });
        } catch (error) {
            console.error("Permission check error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    };
};
