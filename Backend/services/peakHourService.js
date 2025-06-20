const config = require('../config/env');

const isPeakHour = (req) => {
  const mockTime = req?.headers?.mocktime;
  const peakHours = config.peakHours;

  const getCurrentMinutes = () => {
    if (mockTime && process.env.NODE_ENV === 'test') {
      const [h, m] = mockTime.split(':').map(Number);
      return h * 60 + m;
    }
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  const currentMinutes = getCurrentMinutes();

  for (const period of Object.values(peakHours)) {
    const [startH, startM] = period.start.split(':').map(Number);
    const [endH, endM] = period.end.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      return period.multiplier;
    }
  }

  return 1.0;
};

module.exports = { isPeakHour };
