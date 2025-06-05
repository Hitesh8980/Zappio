const Booking = require('../models/Booking');
const Ride = require('../models/Ride');

const confirmBooking = async (bookingId, driverId) => {
  const booking = await Booking.get(bookingId);
  if (!booking) throw new Error('Booking not found');
  await Booking.create({ ...booking, status: 'confirmed', driverId });
  await Ride.update(booking.rideId, { status: 'confirmed' });
};

module.exports = { confirmBooking };