const { db } = require('../config/firebase');
const config = require('../config/env');
const axios = require('axios');
const LocationCache = require('../models/locationCache');

// --- PEAK HOUR LOGIC ---
const isPeakHour = (req) => {
  const mockTime = req?.headers?.mocktime;
  const peakHours = config.peakHours;

  const getCurrentMinutes = () => {
    if (mockTime && process.env.NODE_ENV === 'test') {
      const [h, m] = mockTime.split(':').map(Number);
      return h * 60 + m;
    }
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  const currentMinutes = getCurrentMinutes();

  for (const period of Object.values(peakHours)) {
    const [startH, startM] = period.start.split(':').map(Number);
    const [endH, endM] = period.end.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      return period.multiplier;
    }
  }

  return 1.0;
};

// --- WEATHER MULTIPLIER LOGIC ---
const getWeatherMultiplier = async (pickupLocation, req) => {
  try {
    const mockWeather = req?.headers?.mockweather;
    if (mockWeather && process.env.NODE_ENV === 'test') {
      return config.weather.badConditions[mockWeather]?.multiplier || 1.0;
    }

    const coords = typeof pickupLocation === 'string'
      ? await require('./geoCodingServices').geocodeAddress(pickupLocation)
      : pickupLocation;

    const cacheKey = `weather_${coords.lat}_${coords.lng}`;
    const cached = await LocationCache.getCachedLocation(cacheKey);
    if (cached) return cached.multiplier || 1.0;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true`;
    const response = await axios.get(url);
    const weatherCode = response.data?.current_weather?.weathercode?.toString();

    const badWeatherCodes = ['61', '63', '65', '71', '73', '75', '80', '81', '82'];
    const isBad = badWeatherCodes.includes(weatherCode);
    const multiplier = isBad
      ? config.weather.badConditions.rain.multiplier || 1.2
      : 1.0;

    await LocationCache.cacheLocation(cacheKey, { multiplier }, 10 * 60 * 1000);
    return multiplier;
  } catch (error) {
    console.error('Weather API error:', error.message);
    return 1.0;
  }
};

// --- FARE CALCULATION ---
const calculateFare = async (vehicleType, distanceMeters, durationMinutes, pickupCoords, req) => {
  try {
    const configPricing = config.fare[vehicleType] || {};
    const pricingDoc = await db.collection('pricing').doc(vehicleType).get();

    const dbPricing = pricingDoc.exists ? pricingDoc.data() : {};

    const baseFare     = dbPricing.baseFare      ?? configPricing.base ?? 0;
    const perKmRate    = dbPricing.perKmRate     ?? configPricing.perKm ?? 0;
    const perMinRate   = dbPricing.perMinuteRate ?? configPricing.perMin ?? 0;
    const minimumFare  = dbPricing.minimumFare   ?? configPricing.minimumFare ?? 0;

    const distanceKm = distanceMeters / 1000;
    const base = baseFare + (distanceKm * perKmRate) + (durationMinutes * perMinRate);

    const peakMultiplier = isPeakHour(req);
    const weatherMultiplier = await getWeatherMultiplier(pickupCoords, req);
    const total = Math.max(base * peakMultiplier * weatherMultiplier, minimumFare);

    return {
      total,
      breakdown: {
        base: baseFare,
        distance: distanceKm * perKmRate,
        time: durationMinutes * perMinRate,
        peakSurcharge: base * (peakMultiplier - 1),
        weatherSurcharge: base * peakMultiplier * (weatherMultiplier - 1),
      }
    };
  } catch (error) {
    console.error(`Fare calculation failed for ${vehicleType}:`, error.message);
    throw error;
  }
};

// --- ESTIMATE FOR ALL VEHICLE TYPES ---
// 🚀 NOTE: You must pass `distanceMeters`, `durationMinutes`, and `pickupCoords` from frontend!
const getFareEstimates = async ({ pickupCoords, distanceMeters, durationMinutes }, req) => {
  try {
    const vehicleTypes = ['bike', 'auto', 'car'];
    const estimates = {};

    for (const type of vehicleTypes) {
      const fare = await calculateFare(type, distanceMeters, durationMinutes, pickupCoords, req);
      estimates[type] = {
        total: fare.total,
        breakdown: fare.breakdown
      };
    }

    return { estimates };
  } catch (err) {
    console.error('Failed to get fare estimates:', err.message);
    throw err;
  }
};

module.exports = {
  calculateFare,
  getFareEstimates
};
