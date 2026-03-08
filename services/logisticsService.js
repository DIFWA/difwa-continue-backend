import axios from 'axios';

/**
 * Logistics Service
 * Handles route optimization for delivery riders.
 */
export const optimizeRoute = async (origin, destinations) => {
    // origin: { lat, lng }
    // destinations: [{ lat, lng, orderId }]

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey) {
        try {
            // Google Maps Directions API with waypoint optimization
            const waypoints = destinations.map(d => `${d.lat},${d.lng}`).join('|');
            const response = await axios.get(`https://maps.googleapis.com/maps/api/directions/json`, {
                params: {
                    origin: `${origin.lat},${origin.lng}`,
                    destination: `${origin.lat},${origin.lng}`, // Return to shop
                    waypoints: `optimize:true|${waypoints}`,
                    key: apiKey
                }
            });

            if (response.data.status === 'OK') {
                const waypointOrder = response.data.routes[0].waypoint_order;
                const optimizedPoints = waypointOrder.map(index => destinations[index]);
                return {
                    success: true,
                    optimizedRoute: optimizedPoints,
                    googleData: response.data.routes[0]
                };
            }
        } catch (error) {
            console.error("Google Maps API Error:", error.message);
        }
    }

    // Fallback: Nearest Neighbor Algorithm (Geometric Optimization)
    console.log("Using Fallback Logistics Optimizer (Nearest Neighbor)");
    let currentPos = origin;
    let unvisited = [...destinations];
    let optimizedRoute = [];

    while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = getDistance(currentPos, unvisited[0]);

        for (let i = 1; i < unvisited.length; i++) {
            const dist = getDistance(currentPos, unvisited[i]);
            if (dist < minDist) {
                minDist = dist;
                nearestIdx = i;
            }
        }

        const nextPoint = unvisited.splice(nearestIdx, 1)[0];
        optimizedRoute.push(nextPoint);
        currentPos = nextPoint;
    }

    return {
        success: true,
        optimizedRoute,
        isFallback: true
    };
};

/**
 * Haversine formula for distance between two points
 */
function getDistance(p1, p2) {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
