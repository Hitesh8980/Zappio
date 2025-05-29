// services/weatherServices.js
const axios = require('axios');
const config = require('../config/env');
const LocationCache = require('../models/locationCache');

const getWeatherMultiplier = async (pickupLocation) => {
  const coords = typeof pickupLocation === 'string'
    ? await require('./geoCodingServices').geocodeAddress(pickupLocation)
    : pickupLocation;
  const cacheKey = `weather_${coords.lat}_${coords.lng}`;
  const cachedWeather = await LocationCache.getCachedLocation(cacheKey);
  if (cachedWeather) return cachedWeather.multiplier || 1.0;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${config.weather.apiKey}`;
  const response = await axios.get(url);
  const weather = response.data.weather[0]?.main.toLowerCase();
  const multiplier = config.weather.badConditions[weather]?.multiplier || 1.0;
  await LocationCache.cacheLocation(cacheKey, { multiplier }, 10 * 60 * 1000);
  return multiplier;
};

module.exports = { getWeatherMultiplier };