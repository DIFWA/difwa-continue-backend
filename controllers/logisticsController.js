import Order from "../models/Order.js";
import User from "../models/User.js";
import { optimizeRoute } from "../services/logisticsService.js";

export const getOptimizedRouteForRider = async (req, res) => {
    try {
        const riderId = req.user.id;

        const orders = await Order.find({
            rider: riderId,
            status: { $in: ["Accepted", "Preparing", "Out for Delivery"] }
        });

        if (orders.length === 0) {
            return res.status(200).json({ success: true, data: [], message: "No active orders for routing" });
        }

        const rider = await User.findById(riderId);
        const origin = {
            lat: rider.location?.coordinates[1] || 12.9716,
            lng: rider.location?.coordinates[0] || 77.5946
        };

        const destinations = orders.map(order => ({
            lat: order.deliveryAddress.coordinates.lat,
            lng: order.deliveryAddress.coordinates.lng,
            orderId: order.orderId,
            address: order.deliveryAddress.address
        }));

        // 4. Optimize
        const result = await optimizeRoute(origin, destinations);

        res.status(200).json({
            success: true,
            origin,
            optimizedRoute: result.optimizedRoute,
            isFallback: result.isFallback
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
