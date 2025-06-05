const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create write stream for access logs
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

// Morgan middleware for request logging
const logRequest = morgan('combined', { stream: accessLogStream });

// Custom logging functions for errors and info
const logError = (message) => {
  const logMessage = `${new Date().toISOString()} [ERROR] ${message}\n`;
  fs.appendFileSync(path.join(logsDir, 'error.log'), logMessage);
};

const logInfo = (message) => {
  const logMessage = `${new Date().toISOString()} [INFO] ${message}\n`;
  fs.appendFileSync(path.join(logsDir, 'access.log'), logMessage);
};

module.exports = { logRequest, logError, logInfo };