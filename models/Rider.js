import mongoose from "mongoose";

const riderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    vehicleDetails: {
        vehicleType: {
            type: String,
            enum: ["Bike", "Scooter", "Cycle", "Other"],
            default: "Bike"
        },
        plateNumber: String
    },
    currentLocation: {
        lat: Number,
        lng: Number
    },
    status: {
        type: String,
        enum: ["Available", "On Delivery", "Offline"],
        default: "Offline"
    }
}, { timestamps: true });

export default mongoose.model("Rider", riderSchema);
