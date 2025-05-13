require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

let accessToken = null;
let tokenTimestamp = null;
const TOKEN_VALIDITY_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Function to refresh access token if expired
async function getAccessToken() {
  const now = Date.now();

  if (!accessToken || !tokenTimestamp || now - tokenTimestamp > TOKEN_VALIDITY_MS) {
    console.log('🔄 Access token expired or missing. Refreshing...');

    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      },
    });

    accessToken = response.data.access_token;
    tokenTimestamp = now;
    console.log('✅ New access token acquired');
  }

  return accessToken;
}

// API endpoint
app.post('/find-lead', async (req, res) => {
  const phone = req.body.phone;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const token = await getAccessToken();

    const response = await axios.get('https://www.zohoapis.com/crm/v2/Leads/search', {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
      params: {
        phone: phone,
      },
    });

    const leads = response.data.data;
    if (!leads || leads.length === 0) {
      return res.status(404).json({ error: 'No lead found for this phone number.' });
    }

    const lead = leads[0];
    res.json({
      leadID: lead.id,
      name: lead.Full_Name || `${lead.First_Name || ''} ${lead.Last_Name || ''}`.trim(),
      leadSource: lead.Lead_Source,
      leadInfo: lead.Initial_Lead_information,
    });
  } catch (error) {
    console.error('❌ Zoho API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error fetching lead from Zoho CRM' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
