const { getRideRequest, updateRideRequest } = require('../models/rideRequestModel');
const { update } = require('../models/rideModel');
const { updateDriverStatus } = require('../models/driverModel');
const admin = require('firebase-admin');

const { db } = require('../config/firebase');
const { sendNotification } = require('../services/fcmServices');


const acceptRide = async (req, res) => {
  try {
    const { requestId, driverId } = req.body;
    // if (!req.user || req.user.uid !== driverId) {
       //   return res.status(403).json({ success: false, error: 'Unauthorized' });
       // }

    if (!requestId || !driverId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    await db.runTransaction(async (transaction) => {
      const requestRef = db.collection("rideRequests").doc(requestId);
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists || requestDoc.data().status !== "pending") {
        throw new Error("Request already assigned or expired");
      }

      const rideId = requestDoc.data().rideId;
      const rideRef = db.collection("rides").doc(rideId);
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) throw new Error("Ride not found");

      const driverRef = db.collection("drivers").doc(driverId);

      // 🔐 Lock the request and assign ride
      transaction.update(requestRef, {
        status: "assigned",
        driverId,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(rideRef, {
        driverId,
        status: "assigned",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(driverRef, {
        status: "on_ride",
        currentRideId: rideId,
      });

      // 🔔 Notify other drivers: ride already taken
      const driversSnapshot = await db.collection("drivers")
        .where("isActive", "==", true)
        .get();

      const tokens = driversSnapshot.docs
        .filter(doc => doc.id !== driverId && doc.data().fcmToken?.trim())
        .map(doc => doc.data().fcmToken);

      if (tokens.length > 0) {
        await sendNotification(tokens, {
          title: "Ride Taken",
          body: "This ride has been assigned to another driver.",
        }, { requestId });
      }

      // 🔔 Notify rider: driver assigned
      const userRef = db.collection("users").doc(rideDoc.data().userId);
      const userDoc = await transaction.get(userRef);
      const userToken = userDoc.data()?.fcmToken;

      if (userToken) {
        await sendNotification([userToken], {
          title: "Driver Assigned",
          body: "A driver has been assigned to your ride!",
        }, { rideId, driverId });
      }
    });

    res.json({ success: true, message: "Ride accepted successfully", rideId: requestId });
  } catch (error) {
    console.error("❌ Error accepting ride:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { acceptRide };