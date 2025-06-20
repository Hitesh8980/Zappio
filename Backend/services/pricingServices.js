/**
 * pricingService.js
 *
 * Calculates ride fare including all modifiers:
 * - Tiered distance fare
 * - Base fare
 * - Night surcharge
 * - Peak hour surcharge
 * - Weather surcharge
 * - Long pickup fare
 * - Wait time fare
 * - GST
 */

const { db } = require('../config/firebase');
const config = require('../config/env');
const { isPeakHour } = require('./peakHourService');
const { getWeatherMultiplier } = require('./weatherServices');

const calculateFare = async (vehicleType, distanceMeters, durationMinutes, pickupCoords, req) => {
  try {
    const configPricing = config.fare[vehicleType] || {};
    const pricingDoc = await db.collection('pricing').doc(vehicleType).get();
    const dbPricing = pricingDoc.exists ? pricingDoc.data() : {};

    const distanceKm = distanceMeters / 1000;

    // Tiered Distance Fare
    let distanceFare = 0;
    if (distanceKm <= 2) {
      distanceFare = 0;
    } else if (distanceKm <= 8) {
      distanceFare = (distanceKm - 2) * 6;
    } else {
      distanceFare = (6 * 6) + (distanceKm - 8) * 7;
    }

    // Base Fare
    const baseFare = dbPricing.baseFare ?? configPricing.base ?? 20;

    // Wait Time Charges
    const waitTimeThreshold = 3;
    const waitTimeRate = 1;
    const waitTimeMax = 20;
    const extraWait = Math.max(durationMinutes - waitTimeThreshold, 0);
    const waitCharge = Math.min(extraWait * waitTimeRate, waitTimeMax);

    // Long Pickup Charges
    const pickupDistanceMeters = req?.headers?.pickupdistance || 0;
    const pickupKm = pickupDistanceMeters / 1000;
    let longPickupFare = 0;
    if (pickupKm > 2) {
      longPickupFare = Math.min(pickupKm - 2, 6) * 3;
    }

    // Night Surcharge
    const now = new Date();
    const hours = now.getHours();
    const isNight = hours >= 22 || hours < 6;
    const nightSurchargeRate = isNight ? 0.20 : 0;
    const nightSurchargeAmount = (baseFare + distanceFare + waitCharge + longPickupFare) * nightSurchargeRate;

    // Peak & Weather Multipliers
    const peakMultiplier = isPeakHour(req);
    const weatherMultiplier = await getWeatherMultiplier(pickupCoords, req);

    const subtotal = baseFare + distanceFare + waitCharge + longPickupFare + nightSurchargeAmount;
    const peakAdjusted = subtotal * peakMultiplier;
    const weatherAdjusted = peakAdjusted * weatherMultiplier;

    // GST Calculation
    const gstRate = 0.05;
    const gstAmount = weatherAdjusted * gstRate;
    const totalWithGST = weatherAdjusted + gstAmount;

    return {
      total: parseFloat(totalWithGST.toFixed(2)),
      driverPayout: parseFloat(weatherAdjusted.toFixed(2)),
      gst: parseFloat(gstAmount.toFixed(2)),
      breakdown: {
        baseFare: parseFloat(baseFare.toFixed(2)),
        distanceFare: parseFloat(distanceFare.toFixed(2)),
        waitCharge: parseFloat(waitCharge.toFixed(2)),
        longPickupFare: parseFloat(longPickupFare.toFixed(2)),
        nightSurchargeAmount: parseFloat(nightSurchargeAmount.toFixed(2)),
        peakSurcharge: parseFloat((peakAdjusted - subtotal).toFixed(2)),
        weatherSurcharge: parseFloat((weatherAdjusted - peakAdjusted).toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        peakAdjusted: parseFloat(peakAdjusted.toFixed(2)),
        weatherAdjusted: parseFloat(weatherAdjusted.toFixed(2)),
        gst: parseFloat(gstAmount.toFixed(2)),
        total: parseFloat(totalWithGST.toFixed(2))
      }
    };

  } catch (error) {
    console.error(`Fare calculation failed for ${vehicleType}:`, error.message);
    throw error;
  }
};

const getFareEstimates = async ({ pickupCoords, distanceMeters, durationMinutes }, req) => {
  try {
    const vehicleTypes = ['bike', 'auto', 'car'];
    const estimates = {};

    for (const type of vehicleTypes) {
      const fare = await calculateFare(type, distanceMeters, durationMinutes, pickupCoords, req);
      estimates[type] = {
        total: fare.total,
        driverPayout: fare.driverPayout,
        gst: fare.gst,
        breakdown: fare.breakdown
      };
    }

    return { estimates };
  } catch (err) {
    console.error('Failed to get fare estimates:', err.message);
    throw err;
  }
};

module.exports = {
  calculateFare,
  getFareEstimates
};
