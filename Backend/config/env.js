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
  fare: {
    bike: {
      base: parseFloat(process.env.FARE_BIKE_BASE) || 40,
      perKm: parseFloat(process.env.FARE_BIKE_PER_KM) || 8,
      perMin: parseFloat(process.env.FARE_BIKE_PER_MIN) || 1
    },
    auto: {
      base: parseFloat(process.env.FARE_AUTO_BASE) || 50,
      perKm: parseFloat(process.env.FARE_AUTO_PER_KM) || 12,
      perMin: parseFloat(process.env.FARE_AUTO_PER_MIN) || 1.5
    },
    car: {
      base: parseFloat(process.env.FARE_CAR_BASE) || 60,
      perKm: parseFloat(process.env.FARE_CAR_PER_KM) || 15,
      perMin: parseFloat(process.env.FARE_CAR_PER_MIN) || 2
    }
  },
  peakHours: {
    morning: { start: '07:00', end: '09:00', multiplier: 1.5 },
    evening: { start: '17:00', end: '20:00', multiplier: 1.5 }
  },
  weather: {
    apiKey: process.env.WEATHER_API_KEY,
    badConditions: {
      rain: { multiplier: 1.2 },
      snow: { multiplier: 1.3 },
      storm: { multiplier: 1.5 }
    }
  }

};