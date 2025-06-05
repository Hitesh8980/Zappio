const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});

const calculateDistance = async (origin, destination) => {
  const response = await client.distancematrix({
    params: {
      origins: [origin],
      destinations: [destination],
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });
  const element = response.data.rows[0].elements[0];
  if (element.status !== 'OK') {
    throw new Error('Unable to calculate distance');
  }
  return {
    distance: element.distance, // { text: "10.2 km", value: 10200 }
    duration: element.duration  // { text: "15 mins", value: 900 }
  };
};
module.exports = {
  calculateDistance,
};
