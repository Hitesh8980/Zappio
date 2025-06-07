const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const geofire = require('geofire-common');

async function seedTestData() {
  try {
    // Driver 1
    await db.collection('drivers').doc('D4Vitt9pqBvXhdRfUtji').set({
      name: 'Test Driver',
      mobileNumber: '9999999999',
      role: 'driver',
      verified: true,
      isActive: true,
      status: 'available',
      currentLocation: new admin.firestore.GeoPoint(20.4595, 77.0266),
      g: {
        geohash: geofire.geohashForLocation([20.4595, 77.0266]),
        geopoint: new admin.firestore.GeoPoint(20.4595, 77.0266)
      },
      fcmToken: 'test-fcm-token-1',
      vehicle: { type: 'auto', registration: 'KA01AB1234' },
      preferences: { minRiderRating: 4.0, maxDistance: 20 },
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Driver 2
    await db.collection('drivers').doc('Driver2ID').set({
      name: 'Driver Two',
      mobileNumber: '8888888888',
      role: 'driver',
      verified: true,
      isActive: true,
      status: 'available',
      currentLocation: new admin.firestore.GeoPoint(20.4600, 77.0300),
      g: {
        geohash: geofire.geohashForLocation([20.4600, 77.0300]),
        geopoint: new admin.firestore.GeoPoint(20.4600, 77.0300)
      },
      fcmToken: 'test-fcm-token-2',
      vehicle: { type: 'auto', registration: 'KA02CD5678' },
      preferences: { minRiderRating: 3.5, maxDistance: 15 },
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Driver 3
    await db.collection('drivers').doc('Driver3ID').set({
      name: 'Driver Three',
      mobileNumber: '7777777777',
      role: 'driver',
      verified: true,
      isActive: true,
      status: 'on_ride',
      currentLocation: new admin.firestore.GeoPoint(20.5000, 77.0500),
      g: {
        geohash: geofire.geohashForLocation([20.5000, 77.0500]),
        geopoint: new admin.firestore.GeoPoint(20.5000, 77.0500)
      },
      fcmToken: 'test-fcm-token-3',
      vehicle: { type: 'auto', registration: 'KA03EF9012'},
      preferences: { minRiderRating: 4.0, maxDistance: 10 },
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });

    // User (rider)
    await db.collection('users').doc('test-user-id').set({
      name: 'Test User',
      mobileNumber: '6666666666',
      role: 'rider',
      fcmToken: 'test-fcm-token-rider',
      riderRating: 4.0,
    });

    // Pricing
    // await db.collection('pricing').doc('auto').set({
    //   baseFare: 50,
    //   perKmRate: 10,
    //   perMinuteRate: 2,
    //   minimumFare: 0,
    //   surgeMultiplier: 1.0,
    // });

    console.log('Test data seeded successfully');
  } catch (error) {
    console.error('Error seeding test data:', error);
  }
}

seedTestData().then(() => process.exit());