import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const testUpdate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: "test@gmail.com" });
        
        user.businessDetails = {
            ...user.toObject().businessDetails,
            location: {
                ...(user.businessDetails?.location || {}),
                coordinates: { lat: 26.8604861, lng: 81.0200543 }
            }
        };
        user.markModified('businessDetails');
        await user.save();
        
        const check = await User.findOne({ email: "test@gmail.com" });
        console.log("AFTER UPDATE:", JSON.stringify(check.businessDetails.location, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

testUpdate();
