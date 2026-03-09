

// PORT=5000
// MONGO_URI=mongodb+srv://anushk2026a_db_user:ZldrfxIRRXr5YGTz@cluster0.xuspmih.mongodb.net/shrimpbite?retryWrites=true&w=majority
// JWT_SECRET=supersecretkey
// BASE_URL=http://localhost:5000
// CLOUDINARY_API_KEY=588651514843382
// CLOUDINARY_API_SECRET=eNE5A4pD75BhaAGrzFJFEfi4TjM
// CLOUDINARY_CLOUD_NAME=dwemun2dn
// MONGO_URI=mongodb://pritamcodeservir_db_user:test@ac-dkoln49-shard-00-00.cgru8ib.mongodb.net:27017,ac-dkoln49-shard-00-01.cgru8ib.mongodb.net:27017,ac-dkoln49-shard-00-02.cgru8ib.mongodb.net:27017/shrimpbite?ssl=true&replicaSet=atlas-sr6iad-shard-0&authSource=admin&retryWrites=true&w=majority




// # /////////////////////////////

// # PORT=5000
// # # MONGO_URI=mongodb+srv://anushk2026a_db_user:ZldrfxIRRXr5YGTz@cluster0.xuspmih.mongodb.net/shrimpbite?retryWrites=true&w=majority

// # MONGO_URI=mongodb://pritamcodeservir_db_user:test@ac-dkoln49-shard-00-00.cgru8ib.mongodb.net:27017,ac-dkoln49-shard-00-01.cgru8ib.mongodb.net:27017,ac-dkoln49-shard-00-02.cgru8ib.mongodb.net:27017/shrimpbite?ssl=true&replicaSet=atlas-sr6iad-shard-0&authSource=admin&retryWrites=true&w=majority



// # JWT_SECRET=supersecretkey
// # BASE_URL=http://localhost:5000
// # CLOUDINARY_API_KEY=588651514843382
// # CLOUDINARY_API_SECRET=eNE5A4pD75BhaAGrzFJFEfi4TjM
// # CLOUDINARY_CLOUD_NAME=dwemun2dn

// # RAZORPAY_KEY_ID=rzp_test_S7lSvWtu89c6zD
// # RAZORPAY_KEY_SECRET=Asqdf1VyWUFe6VwQBScZAg51

// # MAP_KEY = AIzaSyBZCSRr8pkuBKSE6eDvYBX4UYzgxJY0_HM


import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
}

async function testConnection() {
    try {
        console.log("Connecting to:", MONGO_URI.split('@')[1] || "Localhost");
        await mongoose.connect(MONGO_URI);
        console.log("Connected Successfully!");

        // Try a simple count
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections names:", collections.map(c => c.name));

        await mongoose.disconnect();
        console.log("Disconnected.");
    } catch (error) {
        console.error("Connection Failed:", error);
    }
}

testConnection();
