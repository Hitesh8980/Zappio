const Pricing = require('../models/pricingModel');
const mapsService = require('../services/mapServices');
const config = require('../config/env');
const axios = require('axios');
const LocationCache = require('../models/locationCache');

// Check if current time is in peak hours
const isPeakHour = (req) => {
  const mockTime = req?.headers?.mocktime;
  if (mockTime && process.env.NODE_ENV === 'test') {
    const [currentHour, currentMinute] = mockTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    for (const period of Object.values(config.peakHours)) {
      const [startHour, startMinute] = period.start.split(':').map(Number);
      const [endHour, endMinute] = period.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        return period.multiplier;
      }
    }
    return 1.0;
  }

  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  for (const period of Object.values(config.peakHours)) {
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

// Fetch weather and determine multiplier
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

    // Corrected URL and field access
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

// Fare calculation
const calculateFare = async (vehicleType, distance, durationMinutes, pickupLocation, req) => {
  console.log('--- Calculating Fare ---');
  console.log('Vehicle Type:', vehicleType);
  console.log('Distance in meters:', distance);
  console.log('Duration in minutes:', durationMinutes);

  const pricing = await Pricing.getPricing(vehicleType);
  console.log('Pricing:', pricing);

  if (!pricing || typeof pricing.baseFare !== 'number' || typeof pricing.perKm !== 'number' || typeof pricing.perMin !== 'number') {
    throw new Error(`Invalid pricing data for vehicle type: ${vehicleType}`);
  }

  const distanceKm = distance / 1000;
  const baseFare = pricing.baseFare + (pricing.perKm * distanceKm) + (pricing.perMin * durationMinutes);

  console.log('Base Fare:', baseFare);

  const peakMultiplier = isPeakHour(req);
  console.log('Peak Multiplier:', peakMultiplier);

  const weatherMultiplier = await getWeatherMultiplier(pickupLocation, req);
  console.log('Weather Multiplier:', weatherMultiplier);

  const finalFare = baseFare * peakMultiplier * weatherMultiplier;
  console.log('Final Fare:', finalFare);

  return {
    total: finalFare,
    breakdown: {
      base: pricing.baseFare,
      distance: pricing.perKm * distanceKm,
      time: pricing.perMin * durationMinutes,
      peakSurcharge: baseFare * (peakMultiplier - 1),
      weatherSurcharge: baseFare * peakMultiplier * (weatherMultiplier - 1)
    }
  };
};


// Fare estimates for all vehicle types
const getFareEstimates = async (pickupLocation, dropLocation, req) => {
  const { distance, duration } = await mapsService.calculateDistance(pickupLocation, dropLocation);
  const vehicleTypes = ['bike', 'car', 'auto'];
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
