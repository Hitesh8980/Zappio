const Ride = require('../models/rideModel');
const { geocodeAddress } = require('../services/geoCodingServices');
const { getRoute } = require('../services/routingServices');
const { calculateFare } = require('../services/pricingServices');
const admin = require('firebase-admin');
const { db } = require('../config/firebase');

exports.createRide = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      pickupLocation,
      dropLocation,
      vehicleType,
      pickupCoords: inputPickupCoords,
      dropCoords: inputDropCoords,
      distanceMeters,
      durationMinutes
    } = req.body;

    const userId = req.entity?.uid || 'test-user-id';

    if (!pickupLocation || !dropLocation || !vehicleType) {
      return res.status(400).json({
        errors: [
          { type: 'field', msg: 'Pickup location is required', path: 'pickupLocation' },
          { type: 'field', msg: 'Drop location is required', path: 'dropLocation' },
          { type: 'field', msg: 'Invalid vehicle type', path: 'vehicleType' }
        ]
      });
    }

    const pickupCoords = inputPickupCoords || (
      typeof pickupLocation === 'string'
        ? await geocodeAddress(pickupLocation)
        : pickupLocation
    );
    const dropCoords = inputDropCoords || (
      typeof dropLocation === 'string'
        ? await geocodeAddress(dropLocation)
        : dropLocation
    );

    if (!pickupCoords?.lat || !pickupCoords?.lng || !dropCoords?.lat || !dropCoords?.lng) {
      throw new Error('Invalid coordinates');
    }

    let route;
    let finalDistanceMeters = distanceMeters;
    let finalDurationMinutes = durationMinutes;
    let routePolyline = '';

    if (!distanceMeters || !durationMinutes) {
      console.log('📡 Fetching route from backend...');
      route = await getRoute(pickupCoords, dropCoords);
      finalDistanceMeters = route.distance.value;
      finalDurationMinutes = route.duration.value / 60;
      routePolyline = route.overview_polyline?.points || '';
    } else {
      console.log('🚀 Using distance & duration from frontend payload...');
      routePolyline = ''; // optional if frontend doesn't send
    }

    const fare = await calculateFare(vehicleType, finalDistanceMeters, finalDurationMinutes, pickupCoords, req);

    const user = (await db.collection('users').doc(userId).get()).data();
    const riderRating = user?.rating || 4.0;

    const rideData = {
      userId,
      pickupLocation: new admin.firestore.GeoPoint(pickupCoords.lat, pickupCoords.lng),
      dropLocation: new admin.firestore.GeoPoint(dropCoords.lat, dropCoords.lng),
      vehicleType,
      distance: {
        value: finalDistanceMeters,
        text: `${(finalDistanceMeters / 1000).toFixed(1)} km`
      },
      duration: {
        value: finalDurationMinutes * 60,
        text: `${Math.round(finalDurationMinutes)} mins`
      },
      fare: fare.total,
      route: routePolyline,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      riderRating
    };

    const rideRef = await db.collection('rides').add(rideData);
    const ride = { id: rideRef.id, ...rideData };

    const requestRef = await db.collection('rideRequests').add({
      rideId: rideRef.id,
      searchRadius: 5,
      status: 'pending',
      vehicleType,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)) // 5 minutes
    });

    const endTime = Date.now();
    console.log(`✅ Ride created in ${endTime - startTime} ms`);

    return res.status(201).json({
      success: true,
      ride: {
        ...ride,
        distance: ride.distance.text,
        duration: ride.duration.text,
        fare: fare.total,
        fareBreakdown: fare.breakdown
      },
      requestId: requestRef.id
    });

  } catch (error) {
    console.error('❌ Error creating ride:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


exports.getRide = async (req, res) => {
  try {
    const ride = await Ride.get(req.params.rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(ride);
  } catch (error) {
    console.error('Error getting ride:', error);
    res.status(500).json({ error: error.message });
  }
};