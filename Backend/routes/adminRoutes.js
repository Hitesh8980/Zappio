const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { deleteDriverDocument } = require('../controllers/adminController');

// Change all admin routes to have /admin prefix
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/users/search', adminController.searchUsers);
router.get('/users/ride-history', adminController.getUserRideHistory);
router.get('/drivers/users', adminController.searchDrivers);
router.get('/rides/search', adminController.searchRides);
router.get('/rides/stats', adminController.getRideStats);  // This will now be /api/admin/rides/stats
router.delete('/drivers/:driverId/documents/:docKey', deleteDriverDocument);
module.exports = router;