import Faq from "../models/Faq.js";

// @desc    Get all FAQs
// @route   GET /api/faq
// @access  Public
export const getFaqs = async (req, res) => {
    try {
        const faqs = await Faq.find().sort({ order: 1, createdAt: -1 });
        res.json({ success: true, count: faqs.length, data: faqs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new FAQ (Admin only)
// @route   POST /api/faq
// @access  Private/Admin
export const createFaq = async (req, res) => {
    try {
        const faq = await Faq.create(req.body);
        res.status(201).json({ success: true, data: faq });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update an FAQ (Admin only)
// @route   PUT /api/faq/:id
// @access  Private/Admin
export const updateFaq = async (req, res) => {
    try {
        const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }
        res.json({ success: true, data: faq });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete an FAQ (Admin only)
// @route   DELETE /api/faq/:id
// @access  Private/Admin
export const deleteFaq = async (req, res) => {
    try {
        const faq = await Faq.findByIdAndDelete(req.params.id);
        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }
        res.json({ success: true, message: "FAQ deleted Successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Seed FAQs
// @route   POST /api/faq/seed
// @access  Public (for initial setup)
export const seedFaqs = async (req, res) => {
    try {
        const initialFaqs = [
            {
                question: "How do I pause my subscription?",
                answer: "Go to the 'Daily' or 'Subscriptions' tab, tap on 'Pause Tomorrow' or enable 'Vacation Mode' for a range of dates.",
                order: 1
            },
            {
                question: "What is the cutoff time for changes?",
                answer: "All changes to your subscription (pausing, resuming, or modifying) must be done before 8:00 PM for the next day's delivery.",
                order: 2
            },
            {
                question: "How do I add money to my wallet?",
                answer: "Open 'My Wallet' from the profile or home screen, tap 'Add Money', enter the amount, and complete the payment via Razorpay.",
                order: 3
            },
            {
                question: "Can I cancel an order?",
                answer: "Subscription orders can only be paused before they are in 'Processing' status. Once order is processing it cannot be paused.",
                order: 4
            },
            {
                question: "My delivery is late, whom should I contact?",
                answer: "You can track your order live from the 'Active Orders' section. If you still need help, use the 'Contact Us' form to reach admin.",
                order: 5
            },
            {
                question: "Is the water tested and pure?",
                answer: "Yes, all our partner water plants are certified and follow strict quality standards. You can view certification details in the about section.",
                order: 6
            }
        ];

        // Only seed if empty, or clear it if specified
        if (req.query.clear === "true") {
            await Faq.deleteMany();
        }

        const count = await Faq.countDocuments();
        if (count === 0) {
            await Faq.insertMany(initialFaqs);
            return res.json({ success: true, message: "FAQs seeded successfully" });
        }

        res.json({ success: true, message: "FAQs already exist" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
