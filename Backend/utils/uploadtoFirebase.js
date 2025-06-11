const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

/**
 * Uploads a file buffer to Firebase Storage and returns the public URL
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} destinationPath - e.g., 'drivers/driverId/aadhaarFront.jpg'
 */
const uploadToFirebase = async (fileBuffer, mimeType, destinationPath) => {
  const bucket = admin.storage().bucket();
  const file = bucket.file(destinationPath);

  const uuid = uuidv4();
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        firebaseStorageDownloadTokens: uuid,
      },
    },
    public: true,
    resumable: false,
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media&token=${uuid}`;
  return url;
};

module.exports = uploadToFirebase;
