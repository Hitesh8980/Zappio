const Booking = require('../models/bookingModel');
const Ride = require('../models/rideModel');
const notificationService = require('../services/notificationServices');

const createBooking = async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    const userId = req.user.uid; // From auth middleware
    
    const ride = await Ride.get(rideId);
    if (!ride || ride.userId !== userId) {
      return res.status(404).json({ error: 'Ride not found or unauthorized' });
    }
    
    // Check driver existence (basic validation)
    const driverSnap = await require('firebase-admin').firestore()
      .collection('drivers').doc(driverId).get();
    if (!driverSnap.exists) {
      return res.status(400).json({ error: 'Driver not found' });
    }
    
    // Create booking
    const bookingData = {
      rideId,
      userId,
      driverId,
      status: 'assigned',
      createdAt: new Date().toISOString()
    };
    const booking = await Booking.create(bookingData);
    
    // Update ride status
    await Ride.update(rideId, { status: 'assigned', driverId });
    
    // Notify driver
    await notificationService.notifyDriver(driverId, booking.id, ride);
    
    res.status(201).json({ bookingId: booking.id, ...bookingData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBooking = async (req, res) => {
  try {
    const booking = await Booking.get(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createBooking, getBooking };
