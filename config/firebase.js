import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(firebaseConfig),
        });
        console.log("┌─── FIREBASE ──────────────────────────────");
        console.log("│ Firebase Admin Initialized ✅");
        console.log("└────────────────────────────────────────────");
    } catch (error) {
        console.error("❌ Firebase Admin Initialization Error:", error.message);
    }
} else {
    console.log("┌─── FIREBASE [SKIP] ───────────────────────");
    console.log("│ Firebase Credentials missing in .env. ");
    console.log("│ Google Auth will not work until set. ");
    console.log("└────────────────────────────────────────────");
}

export default admin;
