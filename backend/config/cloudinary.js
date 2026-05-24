const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Only configure Cloudinary if credentials are provided
const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let upload;

if (hasCloudinary) {
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'college-pm/avatars',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    },
  });
  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'), false);
    },
  });
} else {
  // Fallback: store in memory if Cloudinary not configured
  console.warn('⚠️  Cloudinary not configured — avatar uploads will not be stored persistently.');
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'), false);
    },
  });
}

module.exports = { cloudinary, upload };