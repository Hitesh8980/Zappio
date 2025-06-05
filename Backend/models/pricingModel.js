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
    bike: { baseFare: 20, perKm: 8, perMin: 1 },
    car: { baseFare: 50, perKm: 15, perMin: 2 },
    auto: { baseFare: 30, perKm: 12, perMin: 1.5 }
  };
  for (const [vehicleType, data] of Object.entries(defaultPricing)) {
    const pricingRef = db.collection('pricing').doc(vehicleType);
    const doc = await pricingRef.get();
    const existingData = doc.exists ? doc.data() : {};
    const isInvalid = !doc.exists ||
      typeof existingData.baseFare !== 'number' ||
      typeof existingData.perKm !== 'number' ||
      typeof existingData.perMin !== 'number';
    if (isInvalid) {
      await pricingRef.set(data);
      console.log(`Seeded or fixed pricing for ${vehicleType}`);
    } else {
      console.log(`Pricing for ${vehicleType} already valid`);
    }
  }
};
if (process.env.NODE_ENV !== 'production') {
  seedPricing().catch(console.error);
}


if (process.env.NODE_ENV !== 'production') {
  seedPricing().catch(console.error);
}

module.exports = { getPricing };
