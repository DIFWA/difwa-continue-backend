/**
 * Reverse geocode coordinates to address, city, and pincode.
 */
export const reverseGeocode = async (lat, lng) => {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not set");

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
        );
        const data = await response.json();

        if (data.status === "OK") {
            const result = data.results[0];
            const address = result.formatted_address;
            
            let city = "";
            let pincode = "";
            let state = "";

            result.address_components.forEach(comp => {
                if (comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")) {
                    if (!city) city = comp.long_name;
                }
                if (comp.types.includes("postal_code")) pincode = comp.long_name;
                if (comp.types.includes("administrative_area_level_1")) state = comp.long_name;
            });

            return { address, city, pincode, state };
        }
        throw new Error(`Google API status: ${data.status}`);
    } catch (err) {
        console.error("Reverse geocoding failed:", err.message);
        throw err;
    }
};
