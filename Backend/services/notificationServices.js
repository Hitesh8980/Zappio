const admin = require('firebase-admin');

const notifyDriver = async (driverId, bookingId, ride) => {
  // Placeholder: In a real app, this would send a push notification via FCM
  const message = {
    notification: {
      title: 'New Ride Request',
      body: `Pickup: ${ride.pickupLocation}, Drop: ${ride.dropLocation}, Fare: ${ride.fare}`
    },
    data: { bookingId },
    token: driverId // Assumes driverId is used as FCM token; replace with actual token logic
  };
  try {
    await admin.messaging().send(message);
  } catch (error) {
    console.error('Notification failed:', error);
  }
};

module.exports = { notifyDriver };