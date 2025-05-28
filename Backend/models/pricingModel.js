const admin = require('firebase-admin');
const db = admin.firestore();

const getPricing = async (vehicleType) => {
  const pricingRef = db.collection('pricing').doc(vehicleType);
  const doc = await pricingRef.get();
  if (!doc.exists) {
    throw new Error(`Pricing for ${vehicleType} not found`);
  }
  return doc.data();
};

// Seed initial pricing if not exists
const seedPricing = async () => {
  const defaultPricing = {
    bike: { baseFare: 20, perKm: 10 },
    car: { baseFare: 50, perKm: 15 },
    auto: { baseFare: 30, perKm: 12 }
  };
  for (const [vehicleType, data] of Object.entries(defaultPricing)) {
    const pricingRef = db.collection('pricing').doc(vehicleType);
    const doc = await pricingRef.get();
    if (!doc.exists) {
      await pricingRef.set(data);
    }
  }
};

seedPricing();

module.exports = { getPricing };
