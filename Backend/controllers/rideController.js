const Ride = require("../models/rideModel");
const { geocodeAddress } = require("../services/geoCodingServices");
const { getRoute } = require("../services/routingServices");
const { calculateFare } = require("../services/pricingServices");
const admin = require("firebase-admin");
const { db } = require("../config/firebase");
const geolib = require("geolib");



const generateOtp = () => Math.floor(1000 + Math.random() * 9000);
exports.createRide = async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      pickupLocation,
      dropLocation,
      vehicleType,
      pickupLocationName, // Added to extract from request body
      dropLocationName,   // Added to extract from request body
      pickupCoords: inputPickupCoords,
      dropCoords: inputDropCoords,
      distanceMeters,
      durationMinutes,
      confirmImmediately = false
    } = req.body;

    const userId = req.entity?.uid;
    if (!pickupLocation || !dropLocation || !vehicleType) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🔁 Resolve coordinates
    const pickupCoords = inputPickupCoords || (typeof pickupLocation === "string" ? await geocodeAddress(pickupLocation) : pickupLocation);
    const dropCoords = inputDropCoords || (typeof dropLocation === "string" ? await geocodeAddress(dropLocation) : dropLocation);

    if (!pickupCoords?.lat || !pickupCoords?.lng || !dropCoords?.lat || !dropCoords?.lng) {
      throw new Error("Invalid coordinates");
    }

    // 🗺️ Route & distance calculation
    let routePolyline = "";
    let finalDistance = distanceMeters;
    let finalDuration = durationMinutes;

    if (!finalDistance || !finalDuration) {
      const route = await getRoute(pickupCoords, dropCoords);
      finalDistance = route.distance.value;
      finalDuration = route.duration.value / 60;
      routePolyline = route.overview_polyline?.points || "";
    }

    // 💸 Calculate fare
    const fare = await calculateFare(vehicleType, finalDistance, finalDuration, pickupCoords, req);
    const userDoc = await db.collection("users").doc(userId).get();
    const riderRating = userDoc.data()?.rating || 4.0;

    // 📝 Prepare ride document
    const otp = generateOtp();
    const rideRef = db.collection("rides").doc();
    const rideData = {
      userId,
      pickupLocation: new admin.firestore.GeoPoint(pickupCoords.lat, pickupCoords.lng),
      dropLocation: new admin.firestore.GeoPoint(dropCoords.lat, dropCoords.lng),
      pickupLocationName: pickupLocationName || (typeof pickupLocation === "string" ? pickupLocation : ''),
      dropLocationName: dropLocationName || (typeof dropLocation === "string" ? dropLocation : ''),
      vehicleType,
      distance: { value: finalDistance, text: `${(finalDistance / 1000).toFixed(1)} km` },
      duration: { value: finalDuration * 60, text: `${Math.round(finalDuration)} mins` },
      fare: fare.total,
      fareBreakdown: fare.breakdown,
      route: routePolyline,
      status: "pending",
      riderRating,
      startOtp: otp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 🔁 Create ride and ride request atomically
    const batch = db.batch();
    batch.set(rideRef, rideData);

    const requestRef = db.collection("rideRequests").doc();
    batch.set(requestRef, {
      rideId: rideRef.id,
      status: "pending",
      searchRadius: 5,
      vehicleType,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Fixed typo
    });

    batch.update(db.collection("users").doc(userId), {
      rideHistory: admin.firestore.FieldValue.arrayUnion(rideRef.id)
    });

    await batch.commit();

    const responseData = {
      id: rideRef.id,
      distance: rideData.distance.text,
      duration: rideData.duration.text,
      fare: fare.total,
      fareBreakdown: fare.breakdown,
      pickupLocation: pickupCoords,
      dropLocation: dropCoords,
      pickupLocationName: rideData.pickupLocationName,
      dropLocationName: rideData.dropLocationName,
      vehicleType,
      status: rideData.status,
      createdAt: rideData.createdAt,
    };

    // 🚀 Auto-notify drivers if confirmed immediately
    if (confirmImmediately) {
      const { notifyDrivers } = require("./notificationController");
      await notifyDrivers({ body: { requestId: requestRef.id } }, res);
      return;
    }

    const endTime = Date.now();
    console.log(`✅ Ride created in ${endTime - startTime} ms`);

    return res.status(201).json({
      success: true,
      ride: responseData,
      requestId: requestRef.id,
    });
  } catch (error) {
    console.error("❌ Error creating ride:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};


exports.getRide = async (req, res) => {
  try {
    const ride = await Ride.get(req.params.rideId);
    if (!ride) return res.status(404).json({ 
      success: false,  // Add success flag
      error: ""  // Remove the message
    });
    
    const { startOtp, ...safeRideData } = ride;
    res.json({
      success: true,  // Add success flag
      ride: safeRideData
    });
  } catch (error) {
    console.error("Error getting ride:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

exports.driverArrived = async (req, res) => {
  try {
    const { rideId, driverId, currentLocation } = req.body;

    if (
      !rideId ||
      !driverId ||
      !currentLocation?.lat ||
      !currentLocation?.lng
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const rideRef = db.collection("rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return res.status(404).json({ success: false, error: "Ride not found" });
    }

    const ride = rideSnap.data();

    if (ride.status !== "assigned") {
      return res
        .status(400)
        .json({ success: false, error: "Ride not in assigned state" });
    }

    if (ride.driverId !== driverId) {
      return res
        .status(403)
        .json({ success: false, error: "Driver not authorized for this ride" });
    }

    const pickupLocation = {
      latitude: ride.pickupLocation._latitude,
      longitude: ride.pickupLocation._longitude,
    };

    const distance = geolib.getDistance(pickupLocation, {
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
    });

    if (distance > 50) {
      return res.status(400).json({
        success: false,
        error: "Driver is too far from the pickup location",
        distanceMeters: distance,
      });
    }

    await rideRef.update({
      status: "arrived",
      arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send FCM to rider with OTP
    const userRef = db.collection("users").doc(ride.userId);
    const userDoc = await userRef.get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (fcmToken) {
      const { sendNotification } = require("../services/fcmServices");
      await sendNotification(
        [fcmToken],
        {
          title: "Driver Arrived",
          body: `Your driver has arrived. OTP: ${ride.startOtp}`,
        },
        { rideId }
      );
    }

    return res.json({
      success: true,
      message: "Driver marked as arrived",
      distanceMeters: distance,
    });
  } catch (error) {
    console.error("Error in driverArrived:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.startRide = async (req, res) => {
  try {
    const { rideId, enteredOtp, driverId } = req.body;

    if (!rideId || !enteredOtp || !driverId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const rideRef = db.collection("rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return res.status(404).json({ success: false, error: "Ride not found" });
    }

    const ride = rideSnap.data();

    if (ride.status !== "arrived") {
      return res.status(400).json({ success: false, error: "Ride not in 'arrived' state" });
    }

    if (ride.driverId !== driverId) {
      return res.status(403).json({ success: false, error: "Driver not authorized for this ride" });
    }

    if (ride.startOtp?.toString() !== enteredOtp?.toString()) {
      return res.status(403).json({ success: false, error: "Incorrect OTP" });
    }

    await rideRef.update({
      status: "in_progress",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: "Ride started successfully" });
  } catch (error) {
    console.error("❌ Error starting ride:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.endRide = async (req, res) => {
  try {
    const { rideId, driverId, paymentMode } = req.body;

    if (!rideId || !driverId || !["cash", "qr"].includes(paymentMode)) {
      return res.status(400).json({ success: false, error: "Missing or invalid fields" });
    }

    const rideRef = db.collection("rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return res.status(404).json({ success: false, error: "Ride not found" });
    }

    const ride = rideSnap.data();

    if (ride.status !== "in_progress") {
      return res.status(400).json({ success: false, error: "Ride is not active" });
    }

    if (ride.driverId !== driverId) {
      return res.status(403).json({ success: false, error: "Driver not authorized for this ride" });
    }

    const fare = ride.fare || 0;
    const gstAmount = ride.fareBreakdown?.gst || parseFloat((fare * 0.05).toFixed(2));
    const driverRef = db.collection("drivers").doc(driverId);

    await db.runTransaction(async (transaction) => {
      transaction.update(rideRef, {
        status: "completed",
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentMode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (paymentMode === "qr") {
        transaction.update(driverRef, {
          wallet: admin.firestore.FieldValue.increment(fare - gstAmount),
          gstPaidViaQR: admin.firestore.FieldValue.increment(gstAmount),
        });
      } else if (paymentMode === "cash") {
        transaction.update(driverRef, {
          gstPending: admin.firestore.FieldValue.increment(gstAmount),
          canAcceptRides: false
        });
      }
    });

    return res.json({
      success: true,
      message: `Ride ended. Payment received via ${paymentMode}.`,
      gst: gstAmount,
      creditedToWallet: paymentMode === "qr" ? fare - gstAmount : 0,
      gstPending: paymentMode === "cash" ? gstAmount : 0,
    });
  } catch (error) {
    console.error("❌ Error ending ride:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.cancelRide = async (req, res) => {
  try {
    const { rideId, userId } = req.body;

    if (!rideId || !userId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const rideRef = db.collection("rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return res.status(404).json({ success: false, error: "Ride not found" });
    }

    const ride = rideSnap.data();

    if (ride.userId !== userId) {
      return res.status(403).json({ success: false, error: "User not authorized" });
    }

    if (!["pending", "assigned"].includes(ride.status)) {
      return res.status(400).json({ success: false, error: "Ride cannot be canceled in current state" });
    }

    await rideRef.update({
      status: "canceled",
      canceledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify driver if assigned
    if (ride.driverId) {
      const driverRef = db.collection("drivers").doc(ride.driverId);
      const driverDoc = await driverRef.get();
      const fcmToken = driverDoc.data()?.fcmToken;

      if (fcmToken) {
        const { sendNotification } = require("../services/fcmServices");
        await sendNotification(
          [fcmToken],
          {
            title: "Ride Canceled",
            body: "The ride you were assigned has been canceled by the user.",
          },
          { rideId }
        );
      }
    }

    return res.json({ success: true, message: "Ride canceled successfully" });
  } catch (error) {
    console.error("❌ Error canceling ride:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};