const Ride = require('../models/rideModel');
const Booking = require('../models/bookingModel');
const mapsService = require('../services/mapServices');
const pricingService = require('../services/pricingServices');
const routingService = require('../services/routingServices');

const createRide = async (req, res) => {
  try {
    const { pickupLocation, dropLocation, vehicleType } = req.body;
    const userId = req.entity?.uid || 'test-user-id';

    // Validate required fields
    if (!pickupLocation || !dropLocation || !vehicleType) {
      throw new Error('Missing required fields');
    }

    // Get route information
    const route = await routingService.getRoute(pickupLocation, dropLocation);
    
    // Ensure we have valid route data
    if (!route?.overview_polyline?.points) {
      throw new Error('Invalid route data received from routing service');
    }

    // Prepare ride data with fallback values
    const rideData = {
      userId,
      pickupLocation,
      dropLocation,
      vehicleType,
      distance: route.distance || { value: 0, text: '0 km' },
      duration: route.duration || { value: 0, text: '0 mins' },
      fare: 0, // Will be calculated below
      route: route.overview_polyline.points,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Calculate fare (distance in meters, convert to km)
    const distanceKm = rideData.distance.value / 1000;
    const durationMinutes = rideData.duration.value / 60;
    rideData.fare = await pricingService.calculateFare(vehicleType, distanceKm, durationMinutes);

    // Create ride in Firestore with ignoreUndefinedProperties
    const rideRef = await admin.firestore()
      .collection('rides')
      .add(rideData, { ignoreUndefinedProperties: true });

    const ride = { id: rideRef.id, ...rideData };

    res.status(201).json({
      success: true,
      ride: {
        ...ride,
        distance: ride.distance.text,
        duration: ride.duration.text,
        fare: ride.fare
      }
    });

  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


const getRide = async (req, res) => {
  try {
    const ride = await Ride.get(req.params.rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createRide, getRide };