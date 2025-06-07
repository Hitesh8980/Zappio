const { db } = require('../config/firebase');
const config = require('../config/env');
const mapsService = require('../services/mapServices');
const axios = require('axios');
const LocationCache = require('../models/locationCache');

// Peak hour logic
const isPeakHour = (req) => {
  const mockTime = req?.headers?.mocktime;
  const peakHours = config.peakHours;

  const getCurrentMinutes = () => {
    if (mockTime && process.env.NODE_ENV === 'test') {
      const [currentHour, currentMinute] = mockTime.split(':').map(Number);
      return currentHour * 60 + currentMinute;
    }
    const now = new Date();
    const [currentHour, currentMinute] = now.toTimeString().split(':').map(Number);
    return currentHour * 60 + currentMinute;
  };

  const currentMinutes = getCurrentMinutes();

  for (const period of Object.values(peakHours)) {
    const [startHour, startMinute] = period.start.split(':').map(Number);
    const [endHour, endMinute] = period.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return period.multiplier;
    }
  }

  return 1.0;
};

// Weather multiplier logic
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
    const cachedWeather = await LocationCache.getCachedLocation(cacheKey);
    if (cachedWeather) return cachedWeather.multiplier || 1.0;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true`;
    const response = await axios.get(url);

    const weatherCode = response.data.current_weather.weathercode;
    const badWeatherCodes = ['61', '63', '65', '71', '73', '75', '80', '81', '82'];
    const isBadWeather = badWeatherCodes.includes(weatherCode.toString());

    const multiplier = isBadWeather
      ? config.weather.badConditions.rain.multiplier || 1.2
      : 1.0;

    await LocationCache.cacheLocation(cacheKey, { multiplier }, 10 * 60 * 1000);
    return multiplier;
  } catch (error) {
    console.error('Weather API error:', error.message);
    return 1.0;
  }
};

// 🚀 Updated Fare Calculator
const calculateFare = async (vehicleType, distanceMeters, durationMinutes, pickupCoords, req) => {
  try {
    const pricingDoc = await db.collection('pricing').doc(vehicleType).get();
    const dbPricing = pricingDoc.exists ? pricingDoc.data() : {};
    const configPricing = config.fare[vehicleType] || {};

    const baseFareValue = dbPricing.baseFare ?? configPricing.base ?? 0;
    const perKmRate = dbPricing.perKmRate ?? configPricing.perKm ?? 0;
    const perMinuteRate = dbPricing.perMinuteRate ?? configPricing.perMin ?? 0;
    const minimumFare = dbPricing.minimumFare ?? configPricing.minimumFare ?? 0;

    const distanceKm = distanceMeters / 1000;
    const baseFare = baseFareValue + (distanceKm * perKmRate) + (durationMinutes * perMinuteRate);
    const peakMultiplier = isPeakHour(req, vehicleType); // Pass vehicleType
    const weatherMultiplier = await getWeatherMultiplier(pickupCoords, req);
    const total = Math.max(baseFare * peakMultiplier * weatherMultiplier, minimumFare);

    console.log('--- Calculating Fare ---', {
      vehicleType,
      distanceMeters,
      distanceKm,
      durationMinutes,
      pricing: {
        baseFare: baseFareValue,
        perKmRate,
        perMinuteRate,
        minimumFare
      },
      baseFare,
      peakMultiplier,
      weatherMultiplier,
      total
    });

    return {
      total,
      breakdown: {
        base: baseFareValue,
        distance: distanceKm * perKmRate,
        time: durationMinutes * perMinuteRate,
        peakSurcharge: baseFare * (peakMultiplier - 1),
        weatherSurcharge: baseFare * peakMultiplier * (weatherMultiplier - 1)
      }
    };
  } catch (error) {
    console.error('Error calculating fare:', error.message);
    throw error;
  }
};

// Estimates for all vehicle types
const getFareEstimates = async (pickupLocation, dropLocation, req) => {
  const { distance, duration } = await mapsService.calculateDistance(pickupLocation, dropLocation);
  const vehicleTypes = ['bike', 'auto', 'car'];
  const estimates = {};

  for (const type of vehicleTypes) {
    const fare = await calculateFare(type, distance.value, duration.value / 60, pickupLocation, req);
    estimates[type] = {
      total: fare.total,
      breakdown: fare.breakdown
    };
  }

  return {
    distance: distance.text,
    duration: duration.text,
    estimates
  };
};

module.exports = { calculateFare, getFareEstimates };
