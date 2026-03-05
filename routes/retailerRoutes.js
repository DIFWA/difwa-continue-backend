import protectAppUser from "../middleware/appAuthMiddleware.js";
import { protect, retailerOnly } from "../middleware/authMiddleware.js";
import {
    getRetailerProducts,
    createProduct,
    updateProduct,
    deleteProduct
} from "../controllers/productController.js";

const router = express.Router();

// Get all categories for retailers
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Product Management
router.get("/products", protect, retailerOnly, getRetailerProducts);
router.post("/products", protect, retailerOnly, createProduct);
router.put("/products/:id", protect, retailerOnly, updateProduct);
router.delete("/products/:id", protect, retailerOnly, deleteProduct);

export default router;
