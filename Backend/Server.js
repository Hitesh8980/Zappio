// src/server.js
const express = require('express');
const config = require('./config/env');
const { db } = require('./config/firebase');

const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/driverRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const rideRoutes = require('./routes/rideRoutes'); 
const locationRoutes = require('./routes/locationRoutes'); 

const rateLimit = require('./middleware/rateLimit');
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');

const app = express();

// Global middlewares
app.use(express.json());
app.use(logger.logRequest);
app.use(rateLimit.ipRateLimit);

// Routes
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Zappio Backend!',
    environment: config.nodeEnv,
    firebaseProjectId: config.firebase.projectId
  });
});

app.get('/test-firebase', async (req, res) => {
  try {
    const testRef = db.collection('test').doc('connection');
    await testRef.set({ timestamp: new Date() });
    const doc = await testRef.get();
    res.status(200).json({
      message: 'Firebase connection successful',
      data: doc.data()
    });
  } catch (error) {
    res.status(500).json({
      message: 'Firebase connection failed',
      error: error.message
    });
  }
});

// API routes
app.use('/api/users', rateLimit.otpRateLimit, userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rides', rideRoutes); 
app.use('/api/locations', locationRoutes); 
app.use('/uploads', express.static('uploads'));


// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv || 'development'} mode`);
});

module.exports = app;