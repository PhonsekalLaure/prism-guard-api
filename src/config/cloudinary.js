const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary using env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file buffer to Cloudinary using streams.
 * @param {Buffer} buffer - The file buffer from multer.
 * @param {String} folder - Cloudinary folder name.
 * @returns {Promise<String>} - The secure URL of the uploaded image/PDF.
 */
function uploadBufferToCloudinary(buffer, folder = 'prism_guard_clearances') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = {
  cloudinary,
  uploadBufferToCloudinary
};
