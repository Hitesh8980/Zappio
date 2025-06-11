// middlewares/upload.js
const multer = require('multer');

const storage = multer.memoryStorage(); // Store files in memory (buffer)

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only images and PDFs are allowed'), false);
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
