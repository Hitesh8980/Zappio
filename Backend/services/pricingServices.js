// // services/pricingServices.js
// const Pricing = require('../models/pricingModel');
// const mapsService = require('../services/mapServices');
// const config = require('../config/env');
// const axios = require('axios');
// const LocationCache = require('../models/locationCache');

// // Check if current time is in peak hours
// const isPeakHour = () => {
//   const now = new Date();
//   const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
//   const [currentHour, currentMinute] = currentTime.split(':').map(Number);
//   const currentMinutes = currentHour * 60 + currentMinute;

//   for (const period of Object.values(config.peakHours)) {
//     const [startHour, startMinute] = period.start.split(':').map(Number);
//     const [endHour, endMinute] = period.end.split(':').map(Number);
//     const startMinutes = startHour * 60 + startMinute;
//     const endMinutes = endHour * 60 + endMinute;
//     if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
//       return period.multiplier;
//     }
//   }
//   return 1.0; // No peak hour, no surcharge
// };

// // Fetch weather and determine multiplier
// // services/pricingServices.js
// const getWeatherMultiplier = async (pickupLocation) => {
//   try {
//     const coords = typeof pickupLocation === 'string'
//       ? await require('./geoCodingServices').geocodeAddress(pickupLocation)
//       : pickupLocation;
//     const cacheKey = `weather_${coords.lat}_${coords.lng}`;
//     const cachedWeather = await LocationCache.getCachedLocation(cacheKey);
//     if (cachedWeather) return cachedWeather.multiplier || 1.0;

//     // Fetch weather from Open-Meteo
//     const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true&hourly=precipitation,weather_code`;
//     const response = await axios.get(url);
//     const weatherCode = response.data.current_weather.weather_code;
//     const precip = response.data.hourly.precipitation[0] || 0;

//     // Map WMO weather codes to multipliers (from env.js)
//     const badWeather = precip > 0 || ['61', '63', '65', '71', '73', '75', '80', '81', '82'].includes(weatherCode.toString());
//     const multiplier = badWeather ? config.weather.badConditions.rain.multiplier || 1.2 : 1.0;

//     await LocationCache.cacheLocation(cacheKey, { multiplier }, 10 * 60 * 1000);
//     return multiplier;
//   } catch (error) {
//     console.error('Weather API error:', error.message);
//     return 1.0; // Default to no surcharge on error
//   }
// };

// const calculateFare = async (vehicleType, distance, durationMinutes) => {
//   const pricing = await Pricing.getPricing(vehicleType);
//   const distanceKm = distance / 1000; // Convert meters to km
//   const baseFare = pricing.baseFare + (pricing.perKm * distanceKm) + (pricing.perMin * durationMinutes);
//   const peakMultiplier = isPeakHour();
//   const weatherMultiplier = await getWeatherMultiplier(pickupLocation); // Assumes pickupLocation available
//   const finalFare = baseFare * peakMultiplier * weatherMultiplier;
//   return {
//     total: finalFare,
//     breakdown: {
//       base: pricing.baseFare,
//       distance: pricing.perKm * distanceKm,
//       time: pricing.perMin * durationMinutes,
//       peakSurcharge: baseFare * (peakMultiplier - 1),
//       weatherSurcharge: baseFare * peakMultiplier * (weatherMultiplier - 1)
//     }
//   };
// };

// const getFareEstimates = async (pickupLocation, dropLocation) => {
//   const { distance, duration } = await mapsService.calculateDistance(pickupLocation, dropLocation);
//   const vehicleTypes = ['bike', 'car', 'auto'];
//   const estimates = {};
//   for (const type of vehicleTypes) {
//     const fare = await calculateFare(type, distance.value, duration.value / 60);
//     estimates[type] = {
//       total: fare.total,
//       breakdown: fare.breakdown
//     };
//   }
//   return {
//     distance: distance.text,
//     duration: duration.text,
//     estimates
//   };
// };

// module.exports = { calculateFare, getFareEstimates };
/* services/pricingServices.js */
     const Pricing = require('../models/pricingModel');
     const mapsService = require('../services/mapServices');
     const config = require('../config/env');
     const axios = require('axios');
     const LocationCache = require('../models/locationCache');

     // Check if current time is in peak hours
     const isPeakHour = (req) => {
       const mockTime = req?.headers?.mockTime; // Check for mock time in test
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
       return 1.0; // No peak hour, no surcharge
     };

     // Fetch weather and determine multiplier
     const getWeatherMultiplier = async (pickupLocation, req) => {
       try {
         const mockWeather = req?.headers?.mockWeather;
         if (mockWeather && process.env.NODE_ENV === 'test') {
           return config.weather.badConditions[mockWeather]?.multiplier || 1.0;
         }

         const coords = typeof pickupLocation === 'string'
           ? await require('./geoCodingServices').geocodeAddress(pickupLocation)
           : pickupLocation;

         const cacheKey = `weather_${coords.lat}_${coords.lng}`;
         const cachedWeather = await LocationCache.getCachedLocation(cacheKey);
         if (cachedWeather) return cachedWeather.multiplier || 1.0;

         // Fetch weather from Open-Meteo
         const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}¤t_weather=true&hourly=precipitation,weather_code`;
         const response = await axios.get(url);
         const weatherCode = response.data.current_weather.weather_code;
         const precip = response.data.hourly.precipitation[0] || 0;

         const badWeather = precip > 0 || ['61', '63', '65', '71', '73', '75', '80', '81', '82'].includes(weatherCode.toString());
         const multiplier = badWeather ? config.weather.badConditions.rain.multiplier || 1.2 : 1.0;

         await LocationCache.cacheLocation(cacheKey, { multiplier }, 10 * 60 * 1000);
         return multiplier;
       } catch (error) {
         console.error('Weather API error:', error.message);
         return 1.0; // Default to no surcharge on error
       }
     };

     const calculateFare = async (vehicleType, distance, durationMinutes, pickupLocation, req) => {
       const pricing = await Pricing.getPricing(vehicleType);
       const distanceKm = distance / 1000; // Convert meters to km
       const baseFare = pricing.baseFare + (pricing.perKm * distanceKm) + (pricing.perMin * durationMinutes);
       const peakMultiplier = isPeakHour(req);
       const weatherMultiplier = await getWeatherMultiplier(pickupLocation, req);
       const finalFare = baseFare * peakMultiplier * weatherMultiplier;
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