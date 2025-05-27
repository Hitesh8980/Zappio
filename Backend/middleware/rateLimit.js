const rateLimitStore = {}; // In-memory store: { mobileNumber: timestamp }

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

module.exports = { otpRateLimit };