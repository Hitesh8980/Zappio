// // services/weatherServices.js
// const axios = require('axios');
// const config = require('../config/env');
// const LocationCache = require('../models/locationCache');

// const getWeatherMultiplier = async (pickupLocation) => {
//   const coords = typeof pickupLocation === 'string'
//     ? await require('./geoCodingServices').geocodeAddress(pickupLocation)
//     : pickupLocation;
//   const cacheKey = `weather_${coords.lat}_${coords.lng}`;
//   const cachedWeather = await LocationCache.getCachedLocation(cacheKey);
//   if (cachedWeather) return cachedWeather.multiplier || 1.0;

//   const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${config.weather.apiKey}`;
//   const response = await axios.get(url);
//   const weather = response.data.weather[0]?.main.toLowerCase();
//   const multiplier = config.weather.badConditions[weather]?.multiplier || 1.0;
//   await LocationCache.cacheLocation(cacheKey, { multiplier }, 10 * 60 * 1000);
//   return multiplier;
// };

// module.exports = { getWeatherMultiplier };
const axios = require('axios');
const LocationCache = require('../models/locationCache');
const config = require('../config/env');

const axios = require('axios');

const getWeatherMultiplier = async (pickupLocation) => {
  try {
    const coords = typeof pickupLocation === 'string'
      ? await require('./geoCodingServices').geocodeAddress(pickupLocation)
      : pickupLocation;

    const { lat, lng } = coords;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;

    console.log('📡 Open-Meteo API URL:', url); // For debugging

    const response = await axios.get(url);

    if (!response.data || !response.data.current_weather) {
      throw new Error('Missing current_weather data in response');
    }

    const weatherCode = response.data.current_weather.weathercode;
    console.log('🌦️ Weather Code:', weatherCode);

    const badWeatherCodes = [61, 63, 65, 80, 81, 82]; // Light/moderate/heavy rain
    const multiplier = badWeatherCodes.includes(weatherCode) ? 1.2 : 1.0;

    return multiplier;
  } catch (err) {
    console.error('❌ Weather API error:', err.message);
    return 1.0;
  }
};


module.exports = { getWeatherMultiplier };
