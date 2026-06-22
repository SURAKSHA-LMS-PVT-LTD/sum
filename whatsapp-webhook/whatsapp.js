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

/**
 * Send an interactive LIST message — a tappable menu.
 * Friendlier than asking the user to type a number; the chosen row's `id`
 * comes back in the webhook as interactive.list_reply.id (fully self-contained,
 * so we need no server-side conversation state).
 *
 * @param {string} to
 * @param {string} bodyText      shown above the button
 * @param {string} buttonText    the menu button label (≤20 chars)
 * @param {Array<{id:string,title:string,description?:string}>} rows  (≤10 rows, title ≤24 chars)
 * @param {string} [headerText]
 */
async function sendList(to, bodyText, buttonText, rows, headerText) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error('[WA] Missing credentials for sendList');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const recipient = to.replace(/^\+/, '');
  const interactive = {
    type: 'list',
    body: { text: bodyText.slice(0, 1024) },
    action: {
      button: buttonText.slice(0, 20),
      sections: [{
        title: 'Students',
        rows: rows.slice(0, 10).map((r) => ({
          id: String(r.id).slice(0, 200),
          title: String(r.title).slice(0, 24),
          ...(r.description ? { description: String(r.description).slice(0, 72) } : {}),
        })),
      }],
    },
  };
  if (headerText) interactive.header = { type: 'text', text: String(headerText).slice(0, 60) };

  const body = { messaging_product: 'whatsapp', to: recipient, type: 'interactive', interactive };

  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok && json.messages && json.messages[0]) {
      return { success: true, deliveryId: json.messages[0].id };
    }
    const errMsg = json.error?.message || 'Unknown WhatsApp API error';
    console.error('[WA] sendList failed:', errMsg, json);
    return { success: false, error: errMsg };
  } catch (err) {
    console.error('[WA] sendList network error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send an interactive BUTTONS message with an image header.
 * Supports up to 3 buttons; each button's id comes back in
 * interactive.button_reply.id on tap.
 *
 * @param {string} to
 * @param {string} imageUrl      Publicly reachable HTTPS URL for the header image
 * @param {string} bodyText      Text shown below the image (≤1024 chars)
 * @param {Array<{id:string, title:string}>} buttons  1–3 buttons (title ≤20 chars)
 * @param {string} [footerText]  Optional footer (≤60 chars)
 */
async function sendButtonMenu(to, imageUrl, bodyText, buttons, footerText) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error('[WA] Missing credentials for sendButtonMenu');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const recipient = to.replace(/^\+/, '');
  const interactive = {
    type: 'button',
    header: { type: 'image', image: { link: imageUrl } },
    body: { text: bodyText.slice(0, 1024) },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({
        type: 'reply',
        reply: {
          id: String(b.id).slice(0, 256),
          title: String(b.title).slice(0, 20),
        },
      })),
    },
  };
  if (footerText) interactive.footer = { text: String(footerText).slice(0, 60) };

  const body = { messaging_product: 'whatsapp', to: recipient, type: 'interactive', interactive };

  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok && json.messages && json.messages[0]) {
      return { success: true, deliveryId: json.messages[0].id };
    }
    const errMsg = json.error?.message || 'Unknown WhatsApp API error';
    console.error('[WA] sendButtonMenu failed:', errMsg, json);
    return { success: false, error: errMsg };
  } catch (err) {
    console.error('[WA] sendButtonMenu network error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send an image by public URL with an optional caption.
 * @param {string} to
 * @param {string} imageUrl  Publicly reachable HTTPS URL
 * @param {string} [caption]
 */
async function sendImage(to, imageUrl, caption) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error('[WA] Missing credentials for sendImage');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const recipient = to.replace(/^\+/, '');
  const image = { link: imageUrl };
  if (caption) image.caption = caption;

  const body = { messaging_product: 'whatsapp', to: recipient, type: 'image', image };

  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok && json.messages && json.messages[0]) {
      return { success: true, deliveryId: json.messages[0].id };
    }
    const errMsg = json.error?.message || 'Unknown WhatsApp API error';
    console.error('[WA] sendImage failed:', errMsg, json);
    return { success: false, error: errMsg };
  } catch (err) {
    console.error('[WA] sendImage network error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendText, sendList, sendImage, sendButtonMenu };
