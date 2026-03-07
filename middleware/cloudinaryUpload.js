import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "shrimpbite",
        allowed_formats: ["jpg", "png", "jpeg", "webp", "pdf"],
        resource_type: "auto",
    },
});

const squareStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "shrimpbite/products",
        allowed_formats: ["jpg", "png", "jpeg", "webp"],
        transformation: [
            { width: 1024, height: 1024, crop: "fill", gravity: "center" }
        ]
    }
});

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

export const squareUpload = multer({
    storage: squareStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

export default upload;