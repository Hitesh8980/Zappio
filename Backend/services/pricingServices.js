const Pricing = require('../models/pricingModel');
const mapsService = require('../services/mapServices');

const calculateFare = async (vehicleType, distance) => {
  const pricing = await Pricing.getPricing(vehicleType);
  const distanceKm = distance / 1000; // Convert meters to km
  return pricing.baseFare + pricing.perKm * distanceKm;
};

const getFareEstimates = async (pickupLocation, dropLocation) => {
  const { distance } = await mapsService.calculateDistance(pickupLocation, dropLocation);
  const vehicleTypes = ['bike', 'car', 'auto'];
  const estimates = {};
  for (const type of vehicleTypes) {
    estimates[type] = await calculateFare(type, distance.value);
  }
  return {
    distance: distance.text,
    estimates
  };
};

module.exports = { calculateFare, getFareEstimates };