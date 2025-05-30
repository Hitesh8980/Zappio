const { Client } = require('@googlemaps/google-maps-services-js');
const config = require('../config/env');

const client = new Client({});

// Geocode from address to coordinates
const geocodeAddress = async (address) => {
  try {
    if (!address || typeof address !== 'string') {
      throw new Error('Invalid address provided');
    }

    const response = await client.geocode({
      params: {
        address,
        key: config.googleMaps.apiKey
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding API error: ${response.data.status}`);
    }

    const result = response.data.results[0];
    if (!result) throw new Error('No geocoding results found');

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng
    };
  } catch (error) {
    throw new Error(`Geocoding failed: ${error.message}`);
  }
};

// Reverse geocode from coordinates to address
const reverseGeocode = async ({ lat, lng }) => {
  try {
    const response = await client.reverseGeocode({
      params: {
        latlng: [lat, lng],
        key: config.googleMaps.apiKey
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Reverse geocoding API error: ${response.data.status}`);
    }

    const result = response.data.results[0];
    if (!result) throw new Error('No reverse geocoding results found');

    return result.formatted_address;
  } catch (error) {
    throw new Error(`Reverse geocoding failed: ${error.message}`);
  }
};

// ✅ Export both functions
module.exports = {
  geocodeAddress,
  reverseGeocode
};
