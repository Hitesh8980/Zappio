const Ride = require("../models/rideModel");
const { geocodeAddress } = require("../services/geoCodingServices");
const { getRoute } = require("../services/routingServices");
const { calculateFare } = require("../services/pricingServices");
const admin = require("firebase-admin");
const { db } = require("../config/firebase");
const geolib = require("geolib");

exports.createRide = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      pickupLocation,
      dropLocation,
      vehicleType,
      pickupCoords: inputPickupCoords,
      dropCoords: inputDropCoords,
      distanceMeters,
      durationMinutes,
    } = req.body;

    const userId = req.entity?.uid || "test-user-id";

    if (!pickupLocation || !dropLocation || !vehicleType) {
      return res.status(400).json({
        errors: [
          {
            type: "field",
            msg: "Pickup location is required",
            path: "pickupLocation",
          },
          {
            type: "field",
            msg: "Drop location is required",
            path: "dropLocation",
          },
          { type: "field", msg: "Invalid vehicle type", path: "vehicleType" },
        ],
      });
    }

    const pickupCoords =
      inputPickupCoords ||
      (typeof pickupLocation === "string"
        ? await geocodeAddress(pickupLocation)
        : pickupLocation);
    const dropCoords =
      inputDropCoords ||
      (typeof dropLocation === "string"
        ? await geocodeAddress(dropLocation)
        : dropLocation);

    if (
      !pickupCoords?.lat ||
      !pickupCoords?.lng ||
      !dropCoords?.lat ||
      !dropCoords?.lng
    ) {
      throw new Error("Invalid coordinates");
    }

    let route;
    let finalDistanceMeters = distanceMeters;
    let finalDurationMinutes = durationMinutes;
    let routePolyline = "";

    if (!distanceMeters || !durationMinutes) {
      console.log("📡 Fetching route from backend...");
      route = await getRoute(pickupCoords, dropCoords);
      finalDistanceMeters = route.distance.value;
      finalDurationMinutes = route.duration.value / 60;
      routePolyline = route.overview_polyline?.points || "";
    } else {
      console.log("🚀 Using distance & duration from frontend payload...");
      routePolyline = ""; // optional if frontend doesn't send
    }

    const fare = await calculateFare(
      vehicleType,
      finalDistanceMeters,
      finalDurationMinutes,
      pickupCoords,
      req
    );

    const user = (await db.collection("users").doc(userId).get()).data();
    const riderRating = user?.rating || 4.0;

    const rideData = {
      userId,
      pickupLocation: new admin.firestore.GeoPoint(
        pickupCoords.lat,
        pickupCoords.lng
      ),
      dropLocation: new admin.firestore.GeoPoint(
        dropCoords.lat,
        dropCoords.lng
      ),
      vehicleType,
      distance: {
        value: finalDistanceMeters,
        text: `${(finalDistanceMeters / 1000).toFixed(1)} km`,
      },
      duration: {
        value: finalDurationMinutes * 60,
        text: `${Math.round(finalDurationMinutes)} mins`,
      },
      fare: fare.total,
      route: routePolyline,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      riderRating,
      startOtp: Math.floor(1000 + Math.random() * 9000), // OTP for app display
    };

    const rideRef = await db.collection("rides").add(rideData);
    const ride = { id: rideRef.id, ...rideData };

    const requestRef = await db.collection("rideRequests").add({
      rideId: rideRef.id,
      searchRadius: 5,
      status: "pending",
      vehicleType,
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 5 * 60 * 1000)
      ), // 5 minutes
    });

    // Update user's ride history
    await db.collection("users").doc(userId).update({
      rideHistory: admin.firestore.FieldValue.arrayUnion(rideRef.id),
    });

    const endTime = Date.now();
    console.log(`✅ Ride created in ${endTime - startTime} ms`);

    return res.status(201).json({
      success: true,
      ride: {
        id: rideRef.id,
        distance: ride.distance.text,
        duration: ride.duration.text,
        fare: fare.total,
        fareBreakdown: fare.breakdown,
        pickupLocation: {
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
        },
        dropLocation: {
          lat: dropCoords.lat,
          lng: dropCoords.lng,
        },
        vehicleType,
        status: ride.status,
        createdAt: ride.createdAt,
      },
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
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    // Avoid exposing startOtp in API response
    const { startOtp, ...safeRideData } = ride;
    res.json(safeRideData);
  } catch (error) {
    console.error("Error getting ride:", error);
    res.status(500).json({ error: error.message });
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

    if (ride.status !== "arrived") {
      return res
        .status(400)
        .json({ success: false, error: "Ride not in arrived state" });
    }

    if (ride.driverId !== driverId) {
      return res
        .status(403)
        .json({ success: false, error: "Driver not authorized" });
    }

    if (ride.startOtp !== enteredOtp) {
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

    if (!rideId || !driverId || !['cash', 'qr'].includes(paymentMode)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid fields' });
    }

    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) return res.status(404).json({ success: false, error: 'Ride not found' });

    const ride = rideSnap.data();
    if (ride.status !== 'in_progress') return res.status(400).json({ success: false, error: 'Ride not active' });
    if (ride.driverId !== driverId) return res.status(403).json({ success: false, error: 'Driver not authorized' });

    const fare = ride.fare;
    const gstAmount = ride.fareBreakdown?.gst ?? parseFloat((fare * 0.05).toFixed(2));

    const driverRef = db.collection('drivers').doc(driverId);

    await db.runTransaction(async (transaction) => {
      transaction.update(rideRef, {
        status: 'completed',
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentMode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (paymentMode === 'qr') {
        transaction.update(driverRef, {
          wallet: admin.firestore.FieldValue.increment(fare - gstAmount),
          gstPaidViaQR: admin.firestore.FieldValue.increment(gstAmount)
        });
      } else if (paymentMode === 'cash') {
        transaction.update(driverRef, {
          gstPending: gstAmount,
          canAcceptRides: false
        });
      }
    });

    return res.json({
      success: true,
      message: `Ride ended. Payment received via ${paymentMode}.`,
      gst: gstAmount
    });

  } catch (error) {
    console.error('❌ Error ending ride:', error);
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