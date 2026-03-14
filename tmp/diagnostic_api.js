
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/app'; // Update if needed

async function runDiagnostics() {
    console.log("🔍 Running Shop Status Diagnostics...\n");

    try {
        // 1. Check Public Shops API
        console.log("Checking /shops endpoint...");
        const shopsRes = await axios.get(`${BASE_URL}/shops`);
        if (shopsRes.data.success && shopsRes.data.data.length > 0) {
            const firstShop = shopsRes.data.data[0];
            console.log(`✅ Shops API is responding. First Shop: ${firstShop.name}`);
            console.log(`📊 isShopActive field: ${firstShop.isShopActive}`);
            if (firstShop.isShopActive === undefined) {
                console.log("⚠️ WARNING: isShopActive is UNDEFINED. This will break the app's 'Closed' logic.");
            }
        } else {
            console.log("❌ No shops found or API error.");
        }

        // 2. Check Search API
        console.log("\nChecking /search endpoint...");
        const searchRes = await axios.get(`${BASE_URL}/search?query=a`);
        if (searchRes.data.success && searchRes.data.data.shops.length > 0) {
            const shop = searchRes.data.data.shops[0];
            console.log(`✅ Search API is responding. Shop: ${shop.name}`);
            console.log(`📊 isShopActive field: ${shop.isShopActive}`);
        }

    } catch (error) {
        console.error("❌ Diagnostic Error:", error.message);
    }
}

runDiagnostics();
