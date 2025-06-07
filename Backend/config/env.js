require('dotenv').config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY
  },
  fcm: {
    serviceAccount: {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  },
  fare: {
    bike: {
      base: parseFloat(process.env.FARE_BIKE_BASE) || 10, // Match Firebase
      perKm: parseFloat(process.env.FARE_BIKE_PER_KM) || 5, // Reduced to hit ≤₹82
      perMin: parseFloat(process.env.FARE_BIKE_PER_MIN) || 0.5, // Match Firebase
      minimumFare: parseFloat(process.env.FARE_BIKE_MINIMUM) || 25 // Match Firebase
    },
    auto: {
      base: parseFloat(process.env.FARE_AUTO_BASE) || 20, // Match Firebase
      perKm: parseFloat(process.env.FARE_AUTO_PER_KM) || 10, // Match Firebase
      perMin: parseFloat(process.env.FARE_AUTO_PER_MIN) || 1, // Match Firebase
      minimumFare: parseFloat(process.env.FARE_AUTO_MINIMUM) || 50 // Match Firebase
    },
    car: {
      base: parseFloat(process.env.FARE_CAR_BASE) || 60,
      perKm: parseFloat(process.env.FARE_CAR_PER_KM) || 15,
      perMin: parseFloat(process.env.FARE_CAR_PER_MIN) || 2,
      minimumFare: parseFloat(process.env.FARE_CAR_MINIMUM) || 100
    }
  },
  peakHours: {
    morning: { start: '07:00', end: '09:00', multiplier: 1.0 }, // Disable peak
    evening: { start: '17:00', end: '20:00', multiplier: 1.0 } // Disable peak
  },
  weather: {
    apiKey: process.env.WEATHER_API_KEY,
    badConditions: {
      rain: { multiplier: 1.0 }, // Disable weather surcharge
      snow: { multiplier: 1.0 },
      storm: { multiplier: 1.0 }
    }
  }
};