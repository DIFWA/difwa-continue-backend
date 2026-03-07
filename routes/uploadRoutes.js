import express from "express"
import upload, { squareUpload } from "../middleware/cloudinaryUpload.js"
import { uploadFile } from "../controllers/uploadController.js"

const router = express.Router()

router.post("/", upload.single("file"), uploadFile)
router.post("/image", squareUpload.single("file"), uploadFile)

export default router
