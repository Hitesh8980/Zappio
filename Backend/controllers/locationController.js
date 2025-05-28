const geoCodingServices = require('../services/geoCodingServices'); // Updated to match file name

const getCoordinates = async (req, res) => {
  try {
    const { address } = req.body;
    const coordinates = await geoCodingServices.geocodeAddress(address);
    res.json(coordinates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCurrentLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body; // Assumes frontend sends current location coords
    const address = await geoCodingServices.reverseGeocode(lat, lng);
    res.json({ address, coordinates: { lat, lng } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getCoordinates, getCurrentLocation };