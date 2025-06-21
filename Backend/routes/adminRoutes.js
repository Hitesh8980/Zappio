const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/users/search', adminController.searchUsers);
router.get('/users/ride-history', adminController.getUserRideHistory);
router.get('/drivers/users', adminController.searchDrivers);
router.get('/rides/search', adminController.searchRides);
router.get('/rides/stats', adminController.getRideStats);

module.exports = router;