const axios = require('axios');

class DarajaService {

  constructor(consumerKey, consumerSecret, passkey, shortCode, environment='sandbox') {
    this.consumerKey    = consumerKey;
    this.consumerSecret = consumerSecret;
    this.passkey        = passkey;
    this.shortCode      = shortCode;
    this.env            = environment;
    this.baseURL        = environment === 'live'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  // Get OAuth token
  async getToken() {
    const creds = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const res = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${creds}` },
      timeout: 10000,
    });
    return res.data.access_token;
  }

  // Generate password + timestamp for STK push
  getTimestampAndPassword() {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    const password  = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');
    return { timestamp, password };
  }

  // Initiate STK Push
  async stkPush({ phone, amount, accountRef, description, callbackURL }) {
    const token = await this.getToken();
    const { timestamp, password } = this.getTimestampAndPassword();

    // Normalize phone: 254XXXXXXXXX
    const normalized = phone.replace(/^0/, '254').replace(/^\+/, '').replace(/\s/g,'');

    const body = {
      BusinessShortCode: this.shortCode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Math.ceil(amount),
      PartyA:            normalized,
      PartyB:            this.shortCode,
      PhoneNumber:       normalized,
      CallBackURL:       callbackURL,
      AccountReference:  accountRef || 'Payment',
      TransactionDesc:   description || 'Payment',
    };

    const res = await axios.post(`${this.baseURL}/mpesa/stkpush/v1/processrequest`, body, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return res.data;
  }

  // Query STK Push status
  async stkQuery(checkoutRequestID) {
    const token = await this.getToken();
    const { timestamp, password } = this.getTimestampAndPassword();
    const res = await axios.post(`${this.baseURL}/mpesa/stkpushquery/v1/query`, {
      BusinessShortCode: this.shortCode,
      Password:          password,
      Timestamp:         timestamp,
      CheckoutRequestID: checkoutRequestID,
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return res.data;
  }
}

module.exports = DarajaService;
