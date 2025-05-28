const { Client } = require('@googlemaps/google-maps-services-js');
const LocationCache = require('../models/locationCache');
const client = new Client({});

const geocodeAddress = async (address) => {
  // Check cache first
  const cached = await LocationCache.getCachedLocation(address);
  if (cached) return cached.coordinates;
  
  // Geocode via Google Maps
  const response = await client.geocode({
    params: {
      address,
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });
  if (response.data.results.length === 0) {
    throw new Error('Address not found');
  }
  const coordinates = response.data.results[0].geometry.location;
  
  // Cache result
  await LocationCache.cacheLocation(address, coordinates);
  return coordinates;
};

const reverseGeocode = async (lat, lng) => {
  const response = await client.reverseGeocode({
    params: {
      latlng: { lat, lng },
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });
  if (response.data.results.length === 0) {
    throw new Error('Location not found');
  }
  const address = response.data.results[0].formatted_address;
  await LocationCache.cacheLocation(address, { lat, lng });
  return address;
};

module.exports = { geocodeAddress, reverseGeocode };