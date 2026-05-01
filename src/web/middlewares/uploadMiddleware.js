const multer = require('multer');

const MAX_FILES_PER_REQUEST = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isAllowedMimeType(mimeType = '') {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES_PER_REQUEST,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (req, file, callback) => {
    if (!isAllowedMimeType(file.mimetype)) {
      const error = new Error(`Unsupported file type: ${file.mimetype || 'unknown'}. Only images and PDFs are allowed.`);
      error.status = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

function uploadAny(req, res, next) {
  upload.any()(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
    res.status(status).json({
      error: error.message || 'File upload validation failed.',
    });
  });
}

module.exports = {
  MAX_FILES_PER_REQUEST,
  MAX_FILE_SIZE_BYTES,
  uploadAny,
};
