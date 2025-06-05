const pricingService = require('../services/pricingService');

const getFareEstimate = async (req, res) => {
  try {
    const { pickupLocation, dropLocation } = req.body;
    const estimates = await pricingService.getFareEstimates(pickupLocation, dropLocation);
    res.json(estimates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getFareEstimate };