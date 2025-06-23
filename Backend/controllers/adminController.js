// controllers/adminController.js
const admin = require('firebase-admin');
const { db } = require('../config/firebase');

// ================= Dashboard Stats =================
exports.getDashboardStats = async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const driversSnapshot = await db.collection('drivers').get();
    const ridesSnapshot = await db.collection('rides').get();

    const pendingKyc = driversSnapshot.docs.filter(doc => doc.data().kycStatus === 'pending').length;
    const approvedKyc = driversSnapshot.docs.filter(doc => doc.data().kycStatus === 'approved').length;
    const rejectedKyc = driversSnapshot.docs.filter(doc => doc.data().kycStatus === 'rejected').length;

    res.json({
      success: true,
      data: {
        totalUsers: usersSnapshot.size,
        totalDrivers: driversSnapshot.size,
        totalRides: ridesSnapshot.size,
        kycSummary: {
          pending: pendingKyc,
          approved: approvedKyc,
          rejected: rejectedKyc
        }
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ================= User Search =================
exports.searchUsers = async (req, res) => {
  try {
    const { term } = req.query;

    let query = db.collection('users');

    if (term) {
      let searchTerm = term.toString().trim().replace(/\D/g, '');
      if (searchTerm.startsWith('91') && searchTerm.length > 10) {
        searchTerm = searchTerm.slice(2);
      }
      if (!searchTerm.match(/^\d{10}$/)) {
        return res.status(400).json({ success: false, error: 'Search term must be a valid 10-digit mobile number' });
      }

      query = query.where('mobileNumber', 'in', [`+91${searchTerm}`, searchTerm]);
    }

    const snapshot = await query.limit(20).get();

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.fullName || 'N/A',
        mobileNumber: data.mobileNumber || 'N/A',
        email: data.email || 'N/A',
        createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
        verified: data.verified || false,
      };
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, error: `Failed to search users: ${error.message}` });
  }
};


// ================= User Ride History =================
exports.getUserRideHistory = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

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

// ================= Driver Search =================
exports.searchDrivers = async (req, res) => {
  try {
    const { term = '', status } = req.query;

    const snapshot = await db.collection('drivers').limit(50).get(); // broader fetch

    const drivers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(driver => {
        // Filter by mobileNumber if term exists
        if (term) {
          const cleanTerm = term.toString().trim().replace(/\D/g, '');
          const valuesToCheck = [cleanTerm, `+91${cleanTerm}`];
          if (!valuesToCheck.includes(driver.mobileNumber?.replace(/\s/g, ''))) {
            return false;
          }
        }

        // Filter by KYC status if status exists
        if (status && driver.kycStatus !== status) {
          return false;
        }

        return true;
      })
      .map(driver => ({
        driverId: driver.id,
        name: driver.fullName || 'N/A',
        mobileNumber: driver.mobileNumber || 'N/A',
        kycStatus: driver.kycStatus || 'pending',
        createdAt: driver.createdAt?.toDate().toISOString() || new Date().toISOString(),
        documentStatus: driver.documentStatus || 'pending',
        verified: driver.verified || false,
        documents: driver.documents || {},
      }));

    res.json({ success: true, drivers });
  } catch (error) {
    console.error('Error searching drivers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};



// ================= Ride Search =================
exports.searchRides = async (req, res) => {
  // Response formatter function
  const formatRideResponse = (doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      distance: data.distance?.text || null,
      duration: data.duration?.text || null,
      fare: data.fare || 0,
      pickupLocation: {
        lat: data.pickupLocation?._latitude || data.pickupLocation?.lat || null,
        lng: data.pickupLocation?._longitude || data.pickupLocation?.lng || null
      },
      dropLocation: {
        lat: data.dropLocation?._latitude || data.dropLocation?.lat || null,
        lng: data.dropLocation?._longitude || data.dropLocation?.lng || null
      },
      vehicleType: data.vehicleType,
      status: data.status,
      createdAt: data.createdAt?.toDate()?.toISOString() || null
    };
  };

  try {
    const { term } = req.query;

    // If no term provided, return all rides (paginated)
    if (!term) {
      const ridesSnapshot = await db.collection('rides')
        .orderBy('createdAt', 'desc')
        .limit(50) // Adjust limit as needed
        .get();

      const rides = ridesSnapshot.docs.map(doc => formatRideResponse(doc));
      
      return res.json({
        success: true,
        rides,
        total: rides.length,
        message: rides.length ? 'Rides found' : 'No rides available'
      });
    }

    // If term provided, perform specific search
    const searchId = term.trim();

    // 1. Search in rides collection
    const rideRef = db.collection('rides').doc(searchId);
    const rideSnap = await rideRef.get();

    if (rideSnap.exists) {
      return res.json({
        success: true,
        rides: [formatRideResponse(rideSnap)],
        total: 1
      });
    }

    // 2. Search in rideRequests collection
    const requestQuery = await db.collection('rideRequests')
      .where('rideId', '==', searchId)
      .limit(1)
      .get();

    if (!requestQuery.empty) {
      const requestData = requestQuery.docs[0].data();
      const actualRideRef = db.collection('rides').doc(requestData.rideId);
      const actualRideSnap = await actualRideRef.get();
      
      if (actualRideSnap.exists) {
        return res.json({
          success: true,
          rides: [formatRideResponse(actualRideSnap)],
          requestId: requestQuery.docs[0].id,
          total: 1
        });
      }
    }

    // 3. If not found by ID, try partial matches
    const partialMatches = await db.collection('rides')
      .orderBy('createdAt', 'desc')
      .where('status', '>=', term)
      .where('status', '<=', term + '\uf8ff')
      .limit(10)
      .get();

    const rides = partialMatches.docs.map(doc => formatRideResponse(doc));

    return res.json({
      success: true,
      rides,
      total: rides.length,
      message: rides.length ? 'Partial matches found' : 'No rides found'
    });

  } catch (error) {
    console.error('Error in searchRides:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// ================= Ride Stats =================
// Add this debug version to your adminController.js to replace the existing getRideStats function

exports.getRideStats = async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Use UTC midnight for consistency

    const ridesSnapshot = await db.collection('rides')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
      .get();

    console.log('Rides found:', ridesSnapshot.size); // Debug log
    ridesSnapshot.forEach(doc => console.log(doc.id, doc.data())); // Log ride details

    if (ridesSnapshot.empty) {
      return res.json({
        success: true,
        data: { dailyRides: 0, cancellations: [] },
      });
    }

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
