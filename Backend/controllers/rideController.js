// const Ride = require('../models/rideModel');
// const Booking = require('../models/bookingModel');
// const mapsService = require('../services/mapServices');
// const pricingService = require('../services/pricingServices');
// const routingService = require('../services/routingServices');
// const admin = require('firebase-admin');
// const geoService = require('../services/geoCodingServices');



// // controllers/rideController.js
// const createRide = async (req, res) => {
//   try {
//     const { pickupLocation, dropLocation, vehicleType } = req.body;
//     const userId = req.entity?.uid || 'test-user-id';
//     if (!pickupLocation || !dropLocation || !vehicleType) {
//       throw new Error('Missing required fields');
//     }
// // Geocode both locations (whether they are strings or already coordinates)
//     const pickupCoords = typeof pickupLocation === 'string'
//       ? await geoService.geocodeAddress(pickupLocation)
//       : pickupLocation;
//     const dropCoords = typeof dropLocation === 'string'
//       ? await geoService.geocodeAddress(dropLocation)
//       : dropLocation;
// // Use routing service with lat/lng coordinates
//     const route = await routingService.getRoute(pickupCoords, dropCoords);
//     if (!route?.overview_polyline?.points) {
//       throw new Error('Invalid route data received from routing service');
//     }

//     const rideData = {
//       userId,
//       pickupLocation: pickupCoords,
//       dropLocation: dropCoords,
//       vehicleType,
//       distance: route.distance || { value: 0, text: '0 km' },
//       duration: route.duration || { value: 0, text: '0 mins' },
//       fare: 0,
//       route: route.overview_polyline.points,
//       status: 'pending',
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     };

//     const distanceKm = rideData.distance.value;
//     const durationMinutes = rideData.duration.value / 60;
//     const fare = await pricingService.calculateFare(vehicleType, distanceKm, durationMinutes, pickupLocation);
//     rideData.fare = fare.total;

//     const rideRef = await admin.firestore()
//       .collection('rides')
//       .add(rideData, { ignoreUndefinedProperties: true });

//     const ride = { id: rideRef.id, ...rideData };

//     res.status(201).json({
//       success: true,
//       ride: {
//         ...ride,
//         distance: ride.distance.text,
//         duration: ride.duration.text,
//         fare: fare.total,
//         fareBreakdown: fare.breakdown
//       }
//     });
//   } catch (error) {
//     console.error('Error creating ride:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message,
//       details: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// };
// // ... rest of the file ...
// const getRide = async (req, res) => {
//   try {
//     const ride = await Ride.get(req.params.rideId);
//     if (!ride) return res.status(404).json({ error: 'Ride not found' });
//     res.json(ride);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// module.exports = { createRide, getRide };
const Ride = require('../models/rideModel');
const Booking = require('../models/bookingModel');
const mapsService = require('../services/mapServices');
const pricingService = require('../services/pricingServices');
const routingService = require('../services/routingServices');
const admin = require('firebase-admin');
const geoService = require('../services/geoCodingServices');

const createRide = async (req, res) => {
  try {
    console.log('Starting createRide:', req.body);
    const { pickupLocation, dropLocation, vehicleType } = req.body;
    const userId = req.entity?.uid || 'test-user-id';

    if (!pickupLocation || !dropLocation || !vehicleType) {
      throw new Error('Missing required fields');
    }

    console.log('Geocoding pickup location:', pickupLocation);
    let pickupCoords;
    try {
      pickupCoords = typeof pickupLocation === 'string'
        ? await geoService.geocodeAddress(pickupLocation)
        : pickupLocation;
    } catch (error) {
      console.error('Pickup geocoding failed:', error.message);
      throw new Error(`Pickup geocoding failed: ${error.message}`);
    }
    console.log('Pickup Coordinates:', pickupCoords);

    console.log('Geocoding drop location:', dropLocation);
    let dropCoords;
    try {
      dropCoords = typeof dropLocation === 'string'
        ? await geoService.geocodeAddress(dropLocation)
        : dropLocation;
    } catch (error) {
      console.error('Drop geocoding failed:', error.message);
      throw new Error(`Drop geocoding failed: ${error.message}`);
    }
    console.log('Drop Coordinates:', dropCoords);

    if (!pickupCoords?.lat || !pickupCoords?.lng || !dropCoords?.lat || !dropCoords?.lng) {
      console.error('Invalid coordinates:', { pickupCoords, dropCoords });
      throw new Error('Invalid coordinates from geocoding');
    }

    console.log('Fetching route...');
    const route = await routingService.getRoute(pickupCoords, dropCoords);
    console.log('Route:', route);
    if (!route?.overview_polyline?.points) {
      throw new Error('Invalid route data received from routing service');
    }

    const rideData = {
      userId,
      pickupLocation: pickupCoords,
      dropLocation: dropCoords,
      vehicleType,
      distance: route.distance || { value: 0, text: '0 km' },
      duration: route.duration || { value: 0, text: '0 mins' },
      fare: 0,
      route: route.overview_polyline.points,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Calculating fare...');
    const distanceKm = rideData.distance.value;
    const durationMinutes = rideData.duration.value / 60;
    const fare = await pricingService.calculateFare(vehicleType, distanceKm, durationMinutes, pickupLocation, req);
    rideData.fare = fare.total;

    console.log('Saving ride to Firestore...');
    const rideRef = await admin.firestore()
      .collection('rides')
      .add(rideData, { ignoreUndefinedProperties: true });

    const ride = { id: rideRef.id, ...rideData };

    console.log('Ride created successfully:', ride);
    res.status(201).json({
      success: true,
      ride: {
        ...ride,
        distance: ride.distance.text,
        duration: ride.duration.text,
        fare: fare.total,
        fareBreakdown: fare.breakdown
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
    console.log('Starting getRide:', req.params.rideId);
    const ride = await Ride.get(req.params.rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(ride);
  } catch (error) {
    console.error('Error getting ride:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createRide, getRide };