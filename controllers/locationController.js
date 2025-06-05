const geoCodingServices = require('../services/geoCodingServices');
// allowed for all
// POST /api/locations/geocode
// const getCoordinates = async (req, res) => {
//   try {
//     const { address } = req.body;

//     if (!address || typeof address !== 'string') {
//       return res.status(400).json({ error: 'Address must be a valid string' });
//     }

//     // console.log(`Geocoding address: ${address}`);
//     const coordinates = await geoCodingServices.geocodeAddress(address);

//     res.json({
//       address,
//       coordinates
//     });
//   } catch (error) {
//     console.error('Geocoding failed:', error.message);
//     res.status(500).json({ error: `Geocoding failed: ${error.message}` });
//   }
// };
const allowedCity = 'Gurugram';

const getCoordinates = async (req, res) => {
  try {
    const { address } = req.body;
    const coords = await geoCodingServices.geocodeAddress(address);

    // Now reverse geocode to check the city
    const fullAddress = await geoCodingServices.reverseGeocode(coords);

    if (!fullAddress.includes(allowedCity)) {
      return res.status(403).json({ error: 'Access restricted to Gurugram only' });
    }

    res.json({ address, coordinates: coords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// POST /api/locations/current
const getCurrentLocation = async (req, res) => {
  try {
    let { lat, lng } = req.body;

    lat = parseFloat(lat);
    lng = parseFloat(lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
    }

    // console.log(`Reverse geocoding coordinates: lat=${lat}, lng=${lng}`);
    const address = await geoCodingServices.reverseGeocode({ lat, lng });

    res.json({
      address,
      coordinates: { lat, lng }
    });
  } catch (error) {
    console.error('Reverse geocoding failed:', error.message);
    res.status(500).json({ error: `Reverse geocoding failed: ${error.message}` });
  }
};

module.exports = {
  getCoordinates,
  getCurrentLocation
};
