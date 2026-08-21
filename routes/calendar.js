// Direkter Zugriff auf Google Calendar über einen Service Account – kein OAuth-Login,
// kein ablaufender Token, keine Cowork-/Notion-Limits. Läuft komplett unabhängig.
// Setup: Google Cloud Projekt -> Calendar API an -> Service Account + Key ->
// den eigenen Kalender in den Google-Kalender-Einstellungen mit der Service-Account-
// Mail teilen ("Änderungen an Terminen vornehmen"). Dann als Env-Vars setzen:
// GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_CALENDAR_ID.
const express = require('express');
const crypto = require('crypto');
const https = require('https');
const router = express.Router();

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function konfiguriert() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_CALENDAR_ID);
}

let cachedToken = null; // { token, expiresAt }

function holeAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return Promise.resolve(cachedToken.token);

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));
  const unsigned = header + '.' + claim;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = b64url(signer.sign(key));
  const jwt = unsigned + '.' + signature;
  const body = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwt);

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, r => {
      let chunks = '';
      r.on('data', c => chunks += c);
      r.on('end', () => {
        try {
          const data = JSON.parse(chunks);
          if (!data.access_token) return reject(new Error(data.error_description || data.error || 'Kein Access-Token erhalten'));
          cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
          resolve(data.access_token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function googleFetch(pathAndQuery, accessToken, method, bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = https.request('https://www.googleapis.com' + pathAndQuery, {
      method: method || 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + accessToken },
        bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {})
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          const parsed = chunks ? JSON.parse(chunks) : {};
          if (res.statusCode >= 400) return reject(new Error((parsed.error && parsed.error.message) || ('Google-Fehler ' + res.statusCode)));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

router.get('/', async (req, res) => {
  if (!konfiguriert()) return res.json({ configured: false, events: [] });
  try {
    const token = await holeAccessToken();
    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
    // Optionaler Zeitraum fuer z.B. eine Monatsansicht; sonst Standard: naechste 14 Tage.
    const timeMin = req.query.start ? new Date(req.query.start).toISOString() : new Date().toISOString();
    const timeMax = req.query.end ? new Date(req.query.end).toISOString() : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = req.query.start ? 250 : 15;
    const q = '?timeMin=' + encodeURIComponent(timeMin) + '&timeMax=' + encodeURIComponent(timeMax) +
      '&singleEvents=true&orderBy=startTime&maxResults=' + maxResults;
    const data = await googleFetch('/calendar/v3/calendars/' + calendarId + '/events' + q, token);
    const events = (data.items || []).map(e => ({
      id: e.id,
      title: e.summary || '(ohne Titel)',
      start: (e.start && (e.start.dateTime || e.start.date)) || null,
      allDay: !!(e.start && e.start.date && !e.start.dateTime),
      location: e.location || null
    }));
    res.json({ configured: true, events });
  } catch (e) {
    res.status(200).json({ configured: true, error: e.message, events: [] });
  }
});

router.post('/', async (req, res) => {
  if (!konfiguriert()) return res.status(400).json({ error: 'Kalender ist noch nicht konfiguriert' });
  const b = req.body || {};
  if (!b.title || !b.start) return res.status(400).json({ error: 'title und start sind Pflicht' });
  try {
    const token = await holeAccessToken();
    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
    const event = {
      summary: b.title,
      location: b.location || undefined,
      description: b.description || undefined,
      start: b.allDay ? { date: b.start } : { dateTime: b.start },
      end: b.allDay ? { date: b.end || b.start } : { dateTime: b.end || b.start }
    };
    const data = await googleFetch('/calendar/v3/calendars/' + calendarId + '/events', token, 'POST', event);
    res.status(201).json({ id: data.id, title: data.summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
