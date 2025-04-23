require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const util = require('util');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // To serve index.html

// Plaid Client Setup (Plaid Node v9.x)
const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.CLIENT_ID,
      'PLAID-SECRET': process.env.SECRET,
    },
  },
});
const plaidClient = new PlaidApi(config);

// Serve the HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create Link Token
app.get('/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'unique-user-id' },
      client_name: 'App of Tyler',
      products: ['auth', 'identity'],
      country_codes: ['US'],
      language: 'en',
    });

    res.json({ linkToken: response.data.link_token });
  } catch (err) {
    console.error('Error creating link token:', err);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange Public Token + Fetch All Data
app.post('/token-exchange', async (req, res) => {
  try {
    const { publicToken } = req.body;

    // Exchange token
    const tokenResponse = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = tokenResponse.data.access_token;

    // Fetch Auth
    const authResponse = await plaidClient.authGet({ access_token: accessToken });

    // Fetch Identity
    const identityResponse = await plaidClient.identityGet({ access_token: accessToken });

    // Fetch Balance
    const balanceResponse = await plaidClient.accountsBalanceGet({ access_token: accessToken });

    // Logging (optional)
    console.log('Access Token:', accessToken);
    console.log('Auth:', util.inspect(authResponse.data, false, null, true));
    console.log('Identity:', util.inspect(identityResponse.data, false, null, true));
    console.log('Balance:', util.inspect(balanceResponse.data, false, null, true));

    // Send all data to frontend
    res.json({
      accounts: balanceResponse.data.accounts,
      item: authResponse.data.item,
      numbers: authResponse.data.numbers,
      identity: identityResponse.data,
    });
  } catch (err) {
    console.error('Token exchange or data fetch failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token or fetch data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
