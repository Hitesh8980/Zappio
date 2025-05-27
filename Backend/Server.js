const express = require('express');
const config = require('./config/env');
const { db, auth } = require('./config/firebase');
const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/driverRoutes');
const errorHandler = require('./utils/errorHandler');

const app = express();

app.use(express.json());

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

app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);

app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
});