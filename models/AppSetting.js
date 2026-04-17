import mongoose from "mongoose";

const appSettingSchema = new mongoose.Schema({
    supportEmails: { type: [String], default: ["pritamcodeservir@gmail.com"] }
}, { timestamps: true });

export default mongoose.model("AppSetting", appSettingSchema);
