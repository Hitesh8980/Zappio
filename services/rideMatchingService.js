const { findNearbyDrivers } = require('./driverLocationService');
const { notifyDriver } = require('./notificationService');
const Ride = require('../models/rideModel');

// Timeout for driver response (in seconds)
const DRIVER_RESPONSE_TIMEOUT = 45;

const matchRideToDrivers = async (rideId) => {
  try {
    // Get ride details
    const ride = await Ride.get(rideId);
    if (!ride) throw new Error('Ride not found');
    
    // Find nearby drivers (start with 3km radius)
    let radiusKm = 3;
    let nearbyDrivers = await findNearbyDrivers(
      ride.pickupLocation,
      radiusKm,
      ride.vehicleType
    );

    // If no drivers found, expand search radius
    while (nearbyDrivers.length === 0 && radiusKm <= 10) {
      radiusKm += 2;
      nearbyDrivers = await findNearbyDrivers(
        ride.pickupLocation,
        radiusKm,
        ride.vehicleType
      );
    }

    if (nearbyDrivers.length === 0) {
      await Ride.update(rideId, { status: 'no_drivers_available' });
      return null;
    }

    // Notify top 3 nearest drivers
    const driversToNotify = nearbyDrivers.slice(0, 3);
    const notificationPromises = driversToNotify.map(driver => {
      return notifyDriver(driver.id, rideId, {
        pickup: ride.pickupLocation,
        dropoff: ride.dropLocation,
        fare: ride.fare,
        distance: ride.distance.text,
        timeout: DRIVER_RESPONSE_TIMEOUT
      });
    });

    await Promise.all(notificationPromises);
    
    // Update ride status
    await Ride.update(rideId, {
      status: 'searching_for_driver',
      notifiedDrivers: driversToNotify.map(d => d.id),
      matchingStartedAt: new Date().toISOString()
    });

    return driversToNotify;
  } catch (error) {
    console.error('Ride matching failed:', error);
    await Ride.update(rideId, { status: 'matching_failed' });
    throw error;
  }
};

// Handle driver acceptance
const handleDriverAcceptance = async (rideId, driverId) => {
  try {
    const ride = await Ride.get(rideId);
    
    // Validate ride can still be accepted
    if (ride.status !== 'searching_for_driver') {
      throw new Error('Ride no longer available');
    }

    // Update ride with driver info
    await Ride.update(rideId, {
      status: 'driver_assigned',
      driverId,
      acceptedAt: new Date().toISOString()
    });

    // Notify user that driver is coming
    // await notifyUser(ride.userId, 'driver_accepted', { rideId, driverId });

    return { success: true };
  } catch (error) {
    console.error('Driver acceptance failed:', error);
    throw error;
  }
};

module.exports = {
  matchRideToDrivers,
  handleDriverAcceptance
};