const Ride = require('../models/rideModel');
const { geocodeAddress } = require('../services/geoCodingServices');
const { getRoute } = require('../services/routingServices');
const { calculateFare } = require('../services/pricingServices');
const admin = require('firebase-admin');
const { db } = require('../config/firebase');

exports.createRide = async (req, res) => {
  try {
    const { pickupLocation, dropLocation, vehicleType } = req.body;
    const userId = req.entity?.uid || 'test-user-id';
    if (!pickupLocation || !dropLocation || !vehicleType) {
      throw new Error('Missing required fields');
    }

    const pickupCoords = typeof pickupLocation === 'string' ? await geocodeAddress(pickupLocation) : pickupLocation;
    const dropCoords = typeof dropLocation === 'string' ? await geocodeAddress(dropLocation) : dropLocation;

    if (!pickupCoords.lat || !pickupCoords.lng || !dropCoords.lat || !dropCoords.lng) {
      throw new Error('Invalid coordinates from geocoding');
    }

    const route = await getRoute(pickupCoords, dropCoords);
    if (!route?.overview_polyline?.points) {
      throw new Error('Invalid route data from routing service');
    }

    const distanceKm = route.distance.value / 1000;
    const durationMinutes = route.duration.value / 60;
    const fare = await calculateFare(vehicleType, route.distance.value, durationMinutes, pickupCoords, req);
    console.log('Fare from pricingService:', fare); // Debug log

    const user = (await db.collection('users').doc(userId).get()).data();
    const riderRating = user?.rating || 4.0;

    const rideData = {
      userId,
      pickupLocation: new admin.firestore.GeoPoint(pickupCoords.lat, pickupCoords.lng),
      dropLocation: new admin.firestore.GeoPoint(dropCoords.lat, dropCoords.lng),
      vehicleType,
      distance: route.distance,
      duration: route.duration,
      fare: fare.total,
      route: route.overview_polyline.points,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      riderRating,
    };

    const rideRef = await db.collection('rides').add(rideData);
    const ride = { id: rideRef.id, ...rideData };

    const requestRef = await db.collection('rideRequests').add({
      rideId: rideRef.id,
      searchRadius: 5,
      status: 'pending',
      vehicleType,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)), // 5 minutes
    });

    console.log(`Created rideRequests/${requestRef.id} for rideId: ${rideRef.id}`);

    res.status(201).json({
      success: true,
      ride: {
        ...ride,
        distance: ride.distance.text,
        duration: ride.distance.text,
        fare: fare.total,
        fareBreakdown: fare.breakdown,
      },
      requestId: requestRef.id // Return requestId
    });
  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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