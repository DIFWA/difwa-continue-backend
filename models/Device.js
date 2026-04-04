import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  deviceName: {
    type: String,
    default: "Water Tank Node"
  },
  deviceType: {
    type: String,
    default: "ESP8266"
  },
  waterLevel: {
    type: Number,
    default: 0
  },
  pumpStatus: {
    type: Boolean,
    default: false
  },
  isAutomated: {
    type: Boolean,
    default: true
  },
  autoOnThreshold: {
    type: Number,
    default: 20
  },
  autoOffThreshold: {
    type: Number,
    default: 95
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Device = mongoose.model("Device", deviceSchema);

export default Device;
