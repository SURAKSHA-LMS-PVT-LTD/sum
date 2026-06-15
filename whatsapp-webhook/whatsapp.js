'use strict';

const GRAPH_URL = `https://graph.facebook.com/v18.0`;

/**
 * Send a plain-text WhatsApp session message (free, within 24h window).
 * @param {string} to  Recipient phone number (digits only or with +)
 * @param {string} text  Message body
 * @returns {Promise<{ success: boolean, deliveryId?: string, error?: string }>}
 */
async function sendText(to, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.error('[WA] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const recipient = to.replace(/^\+/, ''); // strip leading +

  const body = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'text',
    text: { body: text },
  };

  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (res.ok && json.messages && json.messages[0]) {
      return { success: true, deliveryId: json.messages[0].id };
    }

    const errMsg = json.error?.message || 'Unknown WhatsApp API error';
    console.error('[WA] Send failed:', errMsg, json);
    return { success: false, error: errMsg };
  } catch (err) {
    console.error('[WA] Network error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendText };
