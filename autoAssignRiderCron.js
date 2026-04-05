import cron from "node-cron";
import Order from "./models/Order.js";
import Rider from "./models/Rider.js";
import mongoose from "mongoose";

// Make all riders available for a specific retailer
const makeAllRidersAvailable = async (retailerId) => {
    try {
        const result = await Rider.updateMany(
            { retailer: retailerId },
            { $set: { status: "Available" } }
        );
        if (result.modifiedCount > 0) {
            console.log(`✅ Made ${result.modifiedCount} riders Available for retailer ${retailerId}`);
        }
        return result.modifiedCount;
    } catch (error) {
        console.log('⚠️ Could not update riders:', error.message);
        return 0;
    }
};

export const autoAssignRiders = async () => {
    if (mongoose.connection.readyState !== 1) {
        console.log('⏳ Waiting for database connection... (cron skipped)');
        return;
    }

    console.log('🔄 Checking for orders without riders...', new Date().toISOString());

    try {
        // Find orders that need riders, grouped by retailer
        const ordersWithoutRider = await Order.find({
            status: { $in: ["Pending", "Accepted", "Rider Assigned", "Processing"] },
            $or: [
                { rider: null },
                { rider: { $exists: false } }
            ]
        }).populate('items.retailer', 'name') // Populate retailer info
            .populate('rider', 'name user')
            .populate('rider.user', 'name');

        if (ordersWithoutRider.length === 0) {
            console.log('✅ No orders waiting for rider assignment');
            return;
        }

        console.log(`📦 Found ${ordersWithoutRider.length} orders needing riders`);

        // Group orders by retailer
        const ordersByRetailer = {};
        for (const order of ordersWithoutRider) {
            // Get retailer ID from order items
            const retailerId = order.items?.[0]?.retailer?._id || order.items?.[0]?.retailer;
            if (!retailerId) {
                console.log(`⚠️ Order ${order.orderId} has no retailer, skipping`);
                continue;
            }

            if (!ordersByRetailer[retailerId]) {
                ordersByRetailer[retailerId] = [];
            }
            ordersByRetailer[retailerId].push(order);
        }

        let totalAssigned = 0;

        // Process orders for each retailer separately
        for (const [retailerId, retailerOrders] of Object.entries(ordersByRetailer)) {
            console.log(`\n🏪 Processing retailer: ${retailerId}`);
            console.log(`📦 ${retailerOrders.length} orders for this retailer`);

            // Get riders that belong to THIS retailer only
            const availableRiders = await Rider.find({
                retailer: retailerId,  // ← IMPORTANT: Only riders of this retailer
                status: "Available"
            }).populate('user', 'name');

            if (availableRiders.length === 0) {
                console.log(`⚠️ No riders available for retailer ${retailerId}`);
                continue;
            }

            // Make all riders available for this retailer
            await makeAllRidersAvailable(retailerId);

            console.log(`🚴 Found ${availableRiders.length} available riders for this retailer`);

            let assigned = 0;

            for (let i = 0; i < retailerOrders.length; i++) {
                const order = retailerOrders[i];
                // Pick random rider from THIS retailer's riders only
                const randomIndex = Math.floor(Math.random() * availableRiders.length);
                const rider = availableRiders[randomIndex];

                try {
                    order.rider = rider._id;
                    order.riderAssignmentStatus = "Pending";
                    order.status = "Rider Assigned";
                    await order.save();

                    assigned++;
                    const riderName = rider.user?.name || rider._id;
                    console.log(`✅ Assigned ${riderName} to order ${order.orderId}`);

                } catch (err) {
                    console.error(`❌ Failed to assign rider to order ${order.orderId}:`, err.message);
                }
            }

            totalAssigned += assigned;
            console.log(`🎉 Assigned ${assigned} out of ${retailerOrders.length} orders for this retailer`);
        }

        console.log(`\n🎉 TOTAL: Successfully assigned ${totalAssigned} out of ${ordersWithoutRider.length} orders`);

    } catch (error) {
        console.error('❌ Auto-assign cron error:', error);
    }
};

const startCronWhenDBReady = () => {
    if (mongoose.connection.readyState === 1) {
        console.log('🚀 Auto-assign riders cron job started (runs every 1 minute)');
        cron.schedule('*/1 * * * *', () => {
            autoAssignRiders();
        });
    } else {
        mongoose.connection.once('connected', async () => {
            console.log('🚀 Auto-assign riders cron job started (runs every 1 minute)');
            cron.schedule('*/1 * * * *', () => {
                autoAssignRiders();
            });
        });
    }
};

startCronWhenDBReady();