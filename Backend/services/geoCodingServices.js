// const { Client } = require('@googlemaps/google-maps-services-js');
// const LocationCache = require('../models/locationCache');
// const client = new Client({});


// const geocodeAddress = async (address) => {
//   // Check cache first
//   const cached = await LocationCache.getCachedLocation(address);
//   if (cached) return cached.coordinates;
  
//   // Geocode via Google Maps
//   const response = await client.geocode({
//     params: {
//       address,
//       key: process.env.GOOGLE_MAPS_API_KEY
//     }
//   });
//   if (response.data.results.length === 0) {
//     throw new Error('Address not found');
//   }
//   const coordinates = response.data.results[0].geometry.location;
  
//   // Cache result
//   await LocationCache.cacheLocation(address, coordinates);
//   return coordinates;
// };

// const reverseGeocode = async (lat, lng) => {
//   const response = await client.reverseGeocode({
//     params: {
//       latlng: { lat, lng },
//       key: process.env.GOOGLE_MAPS_API_KEY
//     }
//   });
//   if (response.data.results.length === 0) {
//     throw new Error('Location not found');
//   }
//   const address = response.data.results[0].formatted_address;
//   await LocationCache.cacheLocation(address, { lat, lng });
//   return address;
// };

// module.exports = { geocodeAddress, reverseGeocode };

const { Client } = require('@googlemaps/google-maps-services-js');
const config = require('../config/env');

const client = new Client({});

const geocodeAddress = async (address) => {
  try {
    console.log('Geocoding address:', address);
    if (!address || typeof address !== 'string') {
      throw new Error('Invalid address provided');
    }

    const response = await client.geocode({
      params: {
        address,
        key: config.googleMaps.apiKey
      }
    });

    console.log('Geocoding response:', response.data);
    if (response.data.status !== 'OK') {
      console.error('Geocoding API error:', response.data.status, response.data.error_message || '');
      throw new Error(`Geocoding API error: ${response.data.status}`);
    }

    const result = response.data.results[0];
    if (!result) {
      console.error('No geocoding results for:', address);
      throw new Error('No geocoding results found');
    }

    const coords = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng
    };
    console.log('Geocoded coords:', coords);
    return coords;
  } catch (error) {
    console.error('Geocoding error:', error.message, error.response?.data || '');
    throw new Error(`Geocoding failed: ${error.message}`);
  }
};

const reverseGeocode = async ({ lat, lng }) => {
  try {
    console.log('Reverse geocoding:', { lat, lng });
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('Invalid coordinates provided');
    }

    const response = await client.reverseGeocode({
      params: {
        latlng: [lat, lng],
        key: config.googleMaps.apiKey
      }
    });

    console.log('Reverse geocoding response:', response.data);
    if (response.data.status !== 'OK') {
      console.error('Reverse geocoding API error:', response.data.status, response.data.error_message || '');
      throw new Error(`Reverse geocoding API error: ${response.data.status}`);
    }

    const result = response.data.results[0];
    if (!result) {
      console.error('No reverse geocoding results for:', { lat, lng });
      throw new Error('No reverse geocoding results found');
    }

    console.log('Reverse geocoded address:', result.formatted_address);
    return result.formatted_address;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message, error.response?.data || '');
    throw new Error(`Reverse geocoding failed: ${error.message}`);
  }
};

module.exports = { geocodeAddress, reverseGeocode };