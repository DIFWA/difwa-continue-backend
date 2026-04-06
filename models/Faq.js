import mongoose from "mongoose";

const faqSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: "General"
    },
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Faq = mongoose.model("Faq", faqSchema);
export default Faq;
