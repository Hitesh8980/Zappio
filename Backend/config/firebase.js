const admin = require('firebase-admin');
const config = require('./env');

const serviceAccount = {
  projectId: config.firebase.projectId,
  privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
  clientEmail: config.firebase.clientEmail
};

// Initialize Firebase App only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: config.firebase.storageBucket // ✅ Make sure this is set
  });
}

console.log('🔥 Firebase initialized with project:', serviceAccount.projectId);

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket(); // ✅ Add this line to get storage bucket

module.exports = {
  db,
  auth,
  bucket // ✅ Export this
};
