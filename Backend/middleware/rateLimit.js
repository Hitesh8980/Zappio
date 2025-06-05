const rateLimit = require('express-rate-limit');

// In-memory store for OTP rate limiting
const rateLimitStore = {}; // { mobileNumber: timestamp }

// Custom middleware for OTP rate limiting
const otpRateLimit = (req, res, next) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber) {
    return res.status(400).json({ message: 'Mobile number is required' });
  }

  const now = Date.now();
  const lastRequest = rateLimitStore[mobileNumber];

  if (lastRequest && (now - lastRequest) < 30 * 1000) { // 30 seconds in ms
    const waitTime = Math.ceil((30 * 1000 - (now - lastRequest)) / 1000);
    return res.status(429).json({ message: `Please wait ${waitTime} seconds before resending OTP` });
  }

  rateLimitStore[mobileNumber] = now; // Update timestamp
  next();
};

// IP-based rate limiting using express-rate-limit
const ipRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: 'Too many requests, please try again later.'
});

// Export both middlewares
module.exports = {
  ipRateLimit, // For general IP-based rate limiting
  otpRateLimit // For OTP-specific rate limiting
};