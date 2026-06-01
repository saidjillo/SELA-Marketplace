const IntaSend = require("intasend-node");

class IntaSendService {
  constructor(publishableKey, secretKey, testMode = false) {
    this.client   = new IntaSend(publishableKey, secretKey, testMode);
    this.testMode = testMode;
  }

  // Initiate M-Pesa STK Push
  async stkPush({ phone, amount, narrative, apiRef, name, email }) {
    const collection = this.client.collection();
    // Normalize phone: 2547XXXXXXXX
    const normalized = phone.replace(/^0/, '254').replace(/^\+/, '').replace(/[^0-9]/g, '');
    const payload = {
      phone_number: normalized,
      amount:       Math.ceil(amount),
      narrative:    narrative || 'Payment',
      api_ref:      apiRef    || ('REF-' + Date.now()),
    };
    if (name)  payload.name  = name;
    if (email) payload.email = email;
    const result = await collection.mpesaStkPush(payload);
    return result; // { id, invoice, customer, ... }
  }

  // Check payment status by invoice ID
  async checkStatus(invoiceId) {
    const collection = this.client.collection();
    const result = await collection.status(invoiceId);
    return result;
  }
}

module.exports = IntaSendService;
