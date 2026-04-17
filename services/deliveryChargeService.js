import DeliveryChargeSetting from "../models/DeliveryChargeSetting.js";

/**
 * Default slabs used if admin hasn't configured any yet.
 */
const DEFAULT_SLABS = [
    { minKm: 0,  maxKm: 2,  charge: 0  },
    { minKm: 2,  maxKm: 5,  charge: 20 },
    { minKm: 5,  maxKm: 8,  charge: 40 },
    { minKm: 8,  maxKm: 12, charge: 70 }
];
const DEFAULT_MAX_KM = 30;

/**
 * Get or auto-create the active delivery charge setting.
 */
export const getDeliveryChargeSetting = async () => {
    let setting = await DeliveryChargeSetting.findOne({ isActive: true });
    if (!setting) {
        setting = await DeliveryChargeSetting.create({
            slabs: DEFAULT_SLABS,
            maxDeliveryKm: DEFAULT_MAX_KM
        });
    }
    return setting;
};

/**
 * Calculate road distance in km using Google Maps Distance Matrix API.
 * Falls back to Haversine straight-line if Google API unavailable.
 */
export const calculateDistanceKm = async (originLat, originLng, destLat, destLng) => {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not set");

        const params = new URLSearchParams({
            origins: `${originLat},${originLng}`,
            destinations: `${destLat},${destLng}`,
            units: "metric",
            key: apiKey
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        const data = await response.json();
        const element = data?.rows?.[0]?.elements?.[0];

        if (element?.status === "OK") {
            return parseFloat((element.distance.value / 1000).toFixed(2));
        }

        throw new Error(`Google API element status: ${element?.status}`);
    } catch (err) {
        console.warn("Google Maps API failed, using Haversine fallback:", err.message);
        return haversineKm(originLat, originLng, destLat, destLng);
    }
};

/**
 * Straight-line distance fallback (Haversine formula).
 */
const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Given a distance in km and the admin slab settings, return the delivery charge.
 * @param {number} distanceKm
 * @param {object} setting  (the DeliveryChargeSetting document)
 * @returns {{ charge: number, slab: object|null, deliverable: boolean }}
 */
export const resolveDeliveryCharge = (distanceKm, setting) => {
    if (distanceKm > setting.maxDeliveryKm) {
        return { charge: null, slab: null, deliverable: false };
    }

    // Find the matching slab (slabs are [minKm, maxKm)  — inclusive min, exclusive max)
    const slab = setting.slabs.find(
        (s) => distanceKm >= s.minKm && distanceKm < s.maxKm
    );

    // Edge case: distance exactly equals the last slab's maxKm
    if (!slab) {
        const lastSlab = [...setting.slabs].sort((a, b) => b.maxKm - a.maxKm)[0];
        if (lastSlab && distanceKm <= lastSlab.maxKm) {
            return { charge: lastSlab.charge, slab: lastSlab, deliverable: true };
        }
        return { charge: null, slab: null, deliverable: false };
    }

    return { charge: slab.charge, slab, deliverable: true };
};
