const { body, validationResult } = require('express-validator');

const validateCreateRide = [
  body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
  body('dropLocation').notEmpty().withMessage('Drop location is required'),
  body('vehicleType').isIn(['bike', 'car', 'auto']).withMessage('Invalid vehicle type'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateCreateRide };