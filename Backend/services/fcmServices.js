const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const getAccessToken = async () => {
  try {
    const { project_id, client_email, private_key } = config.fcm.serviceAccount;
    const payload = {
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, private_key, { algorithm: 'RS256' });
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    });
    return response.data.access_token;
  } catch (error) {
    throw new Error(`Failed to get FCM access token: ${error.message}`);
  }
};

const sendNotification = async (tokens, notification, data) => {
  try {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return { success: false, message: 'No valid tokens provided' };
    }

    const accessToken = await getAccessToken();
    const responses = [];

    for (const token of tokens) {
      const payload = {
        message: {
          token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: Object.keys(data).reduce((acc, key) => ({ ...acc, [key]: String(data[key]) }), {}),
        },
      };

      try {
        const response = await axios.post(
          `https://fcm.googleapis.com/v1/projects/${config.firebase.projectId}/messages:send`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
        responses.push({ token, success: true, response: response.data });
      } catch (error) {
        responses.push({ token, success: false, error: error.response?.data?.error || error.message });
      }
    }

    const successCount = responses.filter(r => r.success).length;
    return {
      success: successCount > 0,
      successCount,
      failureCount: responses.length - successCount,
      responses,
    };
  } catch (error) {
    console.error('FCM error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendNotification };