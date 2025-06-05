const { body, validationResult } = require('express-validator');

const validateCreateBooking = [
  body('rideId').notEmpty().withMessage('Ride ID is required'),
  body('driverId').notEmpty().withMessage('Driver ID is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateCreateBooking };