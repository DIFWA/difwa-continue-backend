
/**
 * native node fetch version (Requires Node 18+)
 */
const BASE_URL = 'https://difwa-backend.vercel.app'; 

async function runDiagnostics() {
    console.log("🔍 Running Shop Status Diagnostics (Native Fetch)...\n");

    try {
        // 1. Check Public Shops API
        console.log(`Checking ${BASE_URL}/shops endpoint...`);
        const shopsRes = await fetch(`${BASE_URL}/shops`);
        const shopsData = await shopsRes.json();
        
        if (shopsData.success && shopsData.data.length > 0) {
            const firstShop = shopsData.data[0];
            console.log(`✅ Shops API is responding. First Shop: ${firstShop.name}`);
            console.log(`📊 isShopActive field value: ${firstShop.isShopActive}`);
            if (firstShop.isShopActive === undefined) {
                console.log("⚠️ WARNING: isShopActive is UNDEFINED. The backend is NOT sending it.");
            }
        } else {
            console.log("❌ No shops found or API error. Response:", JSON.stringify(shopsData));
        }

        // 2. Check Search API
        console.log(`\nChecking ${BASE_URL}/search endpoint...`);
        const searchRes = await fetch(`${BASE_URL}/search?query=a`);
        const searchData = await searchRes.json();
        
        if (searchData.success && searchData.data.shops && searchData.data.shops.length > 0) {
            const shop = searchData.data.shops[0];
            console.log(`✅ Search API is responding. Shop: ${shop.name}`);
            console.log(`📊 isShopActive field value: ${shop.isShopActive}`);
        } else {
            console.log("❌ Search API returned no shops or failed. Try a more common letter if data is sparse.");
        }

    } catch (error) {
        console.error("❌ Diagnostic Error:", error);
        console.log("\nTIP: Make sure your backend server is actually running on port 5000 before running this script.");
    }
}

runDiagnostics();
