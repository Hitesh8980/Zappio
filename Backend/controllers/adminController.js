const { db } = require('../config/firebase');
const admin = require('firebase-admin');

exports.getDashboardStats = async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const driversSnapshot = await db.collection('drivers').get();
    const ridesSnapshot = await db.collection('rides').get();
    const pendingKyc = driversSnapshot.docs.filter(doc => doc.data().kycStatus === 'pending').length;

    res.json({
      success: true,
      data: {
        totalUsers: usersSnapshot.size,
        totalDrivers: driversSnapshot.size,
        totalRides: ridesSnapshot.size,
        pendingKyc,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }

    const usersSnapshot = await db.collection('users')
      .where('mobileNumber', '>=', term)
      .where('mobileNumber', '<=', term + '\uf8ff')
      .get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'N/A',
      mobileNumber: doc.data().mobileNumber,
      email: doc.data().email || 'N/A',
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
      verified: doc.data().verified || false,
    }));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserRideHistory = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const ridesSnapshot = await db.collection('rides')
      .where('userId', '==', userId)
      .get();

    const rides = ridesSnapshot.docs.map(doc => ({
      rideId: doc.id,
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
      pickupLocation: {
        lat: doc.data().pickupLocation._latitude,
        lng: doc.data().pickupLocation._longitude,
      },
      dropoffLocation: {
        lat: doc.data().dropLocation._latitude,
        lng: doc.data().dropLocation._longitude,
      },
      status: doc.data().status,
      fare: doc.data().fare,
      cancellationReason: doc.data().cancellationReason || null,
    }));

    res.json({ success: true, rides });
  } catch (error) {
    console.error('Error fetching user ride history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.searchDrivers = async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }

    const driversSnapshot = await db.collection('drivers')
      .where('mobileNumber', '>=', term)
      .where('mobileNumber', '<=', term + '\uf8ff')
      .get();

    const drivers = driversSnapshot.docs.map(doc => ({
      driverId: doc.id,
      name: doc.data().name || 'N/A',
      mobileNumber: doc.data().mobileNumber,
      kycStatus: doc.data().kycStatus || 'pending',
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
      documentStatus: doc.data().documentStatus || 'pending',
      verified: doc.data().verified || false,
      documents: doc.data().documents || {},
    }));

    res.json({ success: true, drivers });
  } catch (error) {
    console.error('Error searching drivers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.searchRides = async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }

    const ridesSnapshot = await db.collection('rides')
      .where('rideId', '>=', term)
      .where('rideId', '<=', term + '\uf8ff')
      .get();

    const rides = ridesSnapshot.docs.map(doc => ({
      rideId: doc.id,
      userId: doc.data().userId,
      driverId: doc.data().driverId || 'N/A',
      pickupLocation: {
        lat: doc.data().pickupLocation._latitude,
        lng: doc.data().pickupLocation._longitude,
      },
      dropoffLocation: {
        lat: doc.data().dropLocation._latitude,
        lng: doc.data().dropLocation._longitude,
      },
      status: doc.data().status,
      fare: doc.data().fare,
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
      cancellationReason: doc.data().cancellationReason || null,
    }));

    res.json({ success: true, rides });
  } catch (error) {
    console.error('Error searching rides:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getRideStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ridesSnapshot = await db.collection('rides')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
      .get();

    const dailyRides = ridesSnapshot.size;
    const cancellations = ridesSnapshot.docs
      .filter(doc => doc.data().status === 'canceled')
      .reduce((acc, doc) => {
        const reason = doc.data().cancellationReason || 'Unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});

    const cancellationsArray = Object.entries(cancellations).map(([reason, count]) => ({
      reason,
      count,
    }));

    res.json({
      success: true,
      data: {
        dailyRides,
        cancellations: cancellationsArray,
      },
    });
  } catch (error) {
    console.error('Error fetching ride stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};