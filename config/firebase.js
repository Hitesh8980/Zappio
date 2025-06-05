const admin = require('firebase-admin');
const config = require('./env');

// Initialize Firebase Admin SDK
const serviceAccount = {
  projectId: config.firebase.projectId,
  privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'), 
  clientEmail: config.firebase.clientEmail
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Export Firestore and Auth instances
const db = admin.firestore();
const auth = admin.auth();

module.exports = {
  db,    // Firestore database instance
  auth   // Firebase authentication instance
};