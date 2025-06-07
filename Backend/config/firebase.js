const admin = require('firebase-admin');
const config = require('./env');

const serviceAccount = {
  projectId: config.firebase.projectId,
  privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
  clientEmail: config.firebase.clientEmail
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

console.log('🔥 Firebase initialized with project:', serviceAccount.projectId);

const db = admin.firestore();
const auth = admin.auth();

module.exports = {
  db,
  auth
};
