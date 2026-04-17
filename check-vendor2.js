import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const checkVendor = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;
        const vendor = await db.collection('users').findOne({ email: "test@gmail.com" });
        console.log("VENDOR _id:", vendor._id.toString());
        console.log("LOCATION:", JSON.stringify(vendor.businessDetails.location, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

checkVendor();
