const axios = require('axios');
const config = require('../config/env');

async function getRoute(start, end) {
  try {
    // Validate input coordinates
    if (!start || !end || 
        typeof start.lat !== 'number' || 
        typeof start.lng !== 'number' ||
        typeof end.lat !== 'number' || 
        typeof end.lng !== 'number') {
      throw new Error('Invalid start or end coordinates');
    }

    // Construct API URL
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', `${start.lat},${start.lng}`);
    url.searchParams.append('destination', `${end.lat},${end.lng}`);
    url.searchParams.append('key', config.googleMaps.apiKey);

    // Make API request
    const response = await axios.get(url.toString());
    const data = response.data;

    // Handle API errors
    if (data.status !== 'OK') {
      const errorMsg = data.error_message || 'No error message provided';
      throw new Error(`Google Maps API error: ${data.status} - ${errorMsg}`);
    }

    if (!data.routes?.length) {
      throw new Error('No routes found in API response');
    }

    // Extract route data
    const route = data.routes[0];
    const primaryLeg = route.legs[0];

    return {
      overview_polyline: route.overview_polyline,
      distance: primaryLeg.distance,  // { value: meters, text: 'x mi' }
      duration: primaryLeg.duration,  // { value: seconds, text: 'x mins' }
      warnings: route.warnings || []
    };

  } catch (error) {
    console.error('[Routing Service Error]', error.message);
    throw new Error(`Routing failed: ${error.message}`);
  }
}

module.exports = {
  getRoute
};