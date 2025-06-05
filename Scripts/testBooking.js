// const axios = require('axios');

// const testBooking = async () => {
//   try {
//     // Replace with your idToken from generateIdToken.js
//     const idToken = 'your-id-token';
//     const headers = {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${idToken}`
//     };

//     const bookingData = {
//       pickupLocation: {
//         address: 'Bandra West, Mumbai, India'
//       },
//       dropoffLocation: {
//         address: 'Juhu Beach, Mumbai, India'
//       },
//       vehicleType: 'car'
//     };

//     const response = await axios.post('http://localhost:5000/api/bookings/create', bookingData, { headers });
//     console.log('Booking Response:', response.data);
//   } catch (error) {
//     console.error('Test Booking Error:', error.response ? error.response.data : error.message);
//   }
// };

// testBooking();
/* tests/testBooking.js */
/* Scripts/testBooking.js */
const axios = require('axios');

// Mock function to simulate peak hours
const mockPeakHour = (isPeak) => {
  if (isPeak) {
    console.log('Mocking peak hour: 07:30 AM IST');
  } else {
    console.log('Using current time: 01:52 PM IST (non-peak)');
  }
};

// Mock weather data
const mockWeather = async (condition) => {
  console.log(`Mocking weather: ${condition}`);
  return condition;
};

const testRideBooking = async (scenario, isPeak = false, weatherCondition = 'clear') => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'mockTime': isPeak ? '07:30' : '13:52', // Mock 7:30 AM for peak, 1:52 PM for non-peak
      'mockWeather': weatherCondition // Mock weather: 'clear', 'rain', 'snow', 'storm'
    };

    const rideData = {
      pickupLocation: 'Bandra West, Mumbai, Maharashtra 400050, India', // More specific
      dropLocation: 'Juhu Beach, Mumbai, Maharashtra 400049, India',   // More specific
      vehicleType: 'car'
    };

    console.log(`Testing Scenario: ${scenario}`);
    console.log('Request URL: http://localhost:3000/api/rides');
    console.log('Request Headers:', headers);
    console.log('Request Body:', rideData);
    mockPeakHour(isPeak);
    await mockWeather(weatherCondition);

    const response = await axios.post('http://localhost:3000/api/rides', rideData, {
      headers,
      timeout: 15000 // 15 seconds timeout
    });
    console.log('Ride Response:', response.data);

    // Log fare breakdown for verification
    const { fare, fareBreakdown } = response.data.ride;
    console.log('Fare Details:');
    console.log(`  Total: ${fare}`);
    console.log(`  Breakdown:`, fareBreakdown);
  } catch (error) {
    console.error(`Test ${scenario} Error:`);
    console.error('  Error Message:', error.message);
    if (error.response) {
      console.error('  Response Status:', error.response.status);
      console.error('  Response Data:', error.response.data);
    }
    console.error('  Error Code:', error.code);
    console.error('  Error Config:', error.config ? { url: error.config.url, headers: error.config.headers } : 'No config');
  }
};

// Run test scenarios
(async () => {
  // Scenario 1: Normal (non-peak, clear weather)
  await testRideBooking('Normal (Non-Peak, Clear Weather)', false, 'clear');

  // Scenario 2: Peak Hours, Clear Weather
  await testRideBooking('Peak Hours, Clear Weather)', true, 'clear');

  // Scenario 3: Non-Peak, Bad Weather (Rain)
  await testRideBooking('Non-Peak, Rain)', false, 'rain');

  // Scenario 4: Peak Hours, Bad Weather (Rain)
  await testRideBooking('Peak Hours, Rain)', true, 'rain');
})();
