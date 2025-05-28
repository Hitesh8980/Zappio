const axios = require('axios');

const testBooking = async () => {
  try {
    // Replace with your idToken from generateIdToken.js
    const idToken = 'your-id-token';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };

    const bookingData = {
      pickupLocation: {
        address: 'Bandra West, Mumbai, India'
      },
      dropoffLocation: {
        address: 'Juhu Beach, Mumbai, India'
      },
      vehicleType: 'car'
    };

    const response = await axios.post('http://localhost:5000/api/bookings/create', bookingData, { headers });
    console.log('Booking Response:', response.data);
  } catch (error) {
    console.error('Test Booking Error:', error.response ? error.response.data : error.message);
  }
};

testBooking();