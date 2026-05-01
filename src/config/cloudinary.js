const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { consumeLimiter } = require('@utils/rateLimit');

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
 * @param {Object} options
 * @returns {Promise<String>} - The secure URL of the uploaded image/PDF.
 */
async function uploadBufferToCloudinary(buffer, folder = 'prism_guard_clearances', options = {}) {
  const {
    actorKey = null,
    bypassRateLimit = false,
  } = options;

  if (!bypassRateLimit) {
    await consumeLimiter(
      'cloudinaryUser',
      { keyPrefix: 'provider:cloudinary:user', points: 10, duration: 60 },
      actorKey || 'unknown-actor',
      {
        code: 'RATE_LIMITED_CLOUDINARY_USER',
        message: 'Too many file uploads from this account. Please try again later.',
      }
    );

    await consumeLimiter(
      'cloudinaryGlobal',
      { keyPrefix: 'provider:cloudinary:global', points: 100, duration: 60 },
      'global',
      {
        code: 'RATE_LIMITED_CLOUDINARY_GLOBAL',
        message: 'File uploads are temporarily busy. Please try again later.',
      }
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
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
