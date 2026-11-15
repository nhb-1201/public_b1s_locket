'use strict';

/**
 * B1sTeam — LocketGold (Free)
 * Small HTTP helper shared by every serverless handler.
 *
 * No dependencies: the handlers only rely on the Node 18+ global `fetch`,
 * `Request`/`Response` free `req`/`res` objects used by Vercel & friends.
 */

/** Headers shared by every response. */
const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-B1s-Key, X-Admin-Token',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Parse the request URL.
 *
 * @param {object} req
 * @returns {URL}
 */
function requestUrl(req) {
  const raw =
    (req && (req.url || req.originalUrl)) ||
    (req && req.headers && req.headers.host
      ? `${(req.headers['x-forwarded-proto'] || 'https').split(',')[0]}://${req.headers.host}${
          req.url || '/'
        }`
      : 'http://localhost/');
  try {
    return new URL(raw, 'http://localhost');
  } catch (_err) {
    return new URL('http://localhost/');
  }
}

/**
 * Read a query parameter (Vercel parses `req.query` for us, other runtimes do not).
 *
 * @param {object} req
 * @param {string} name
 * @returns {string}
 */
function getQuery(req, name) {
  if (!req) return '';
  if (req.query && typeof req.query === 'object') {
    const value = req.query[name];
    if (Array.isArray(value)) return String(value[0] || '');
    if (value !== undefined && value !== null) return String(value);
  }
  try {
    const url = requestUrl(req);
    return url.searchParams.get(name) || '';
  } catch (_err) {
    return '';
  }
}

/**
 * Read and parse a JSON request body.
 *
 * @param {object} req
 * @returns {Promise<object>}
 */
async function readJsonBody(req) {
  if (!req) return {};
  if (req.body && typeof req.body === 'object') {
    if (typeof req.body.then === 'function') return (await req.body) || {};
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_err) {
      return {};
    }
  }
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch (_err) {
    return {};
  }
}

/**
 * Send a JSON response.
 *
 * @param {object} res
 * @param {number} status
 * @param {unknown} payload
 * @param {object} [extraHeaders]
 */
function sendJson(res, status, payload, extraHeaders = {}) {
  if (!res) return;
  const headers = { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders };
  if (typeof res.setHeader === 'function') {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    if (typeof res.status === 'function') res.status(status);
    if (typeof res.json === 'function') res.json(payload);
    else res.end(JSON.stringify(payload));
    return;
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/**
 * Send a plain text response.
 *
 * @param {object} res
 * @param {number} status
 * @param {string} text
 * @param {object} [extraHeaders]
 */
function sendText(res, status, text, extraHeaders = {}) {
  if (!res) return;
  const headers = { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders };
  for (const [key, value] of Object.entries(headers)) {
    if (typeof res.setHeader === 'function') res.setHeader(key, value);
  }
  if (typeof res.status === 'function') res.status(status);
  if (typeof res.send === 'function') res.send(text);
  else res.end(text);
}

/**
 * Send a binary response.
 *
 * @param {object} res
 * @param {number} status
 * @param {Buffer|Uint8Array} buffer
 * @param {object} [extraHeaders]
 */
function sendBinary(res, status, buffer, extraHeaders = {}) {
  if (!res) return;
  const headers = { ...BASE_HEADERS, ...extraHeaders };
  for (const [key, value] of Object.entries(headers)) {
    if (typeof res.setHeader === 'function') res.setHeader(key, value);
  }
  if (typeof res.status === 'function') res.status(status);
  if (typeof res.send === 'function') res.send(buffer);
  else res.end(buffer);
}

/**
 * Send a JSON error.
 *
 * @param {object} res
 * @param {number} status
 * @param {string} message
 * @param {object} [extra]
 */
function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { success: false, error: String(message || 'Unknown error'), ...extra });
}

/**
 * Handle the pre-flight request.
 *
 * @param {object} req
 * @param {object} res
 * @returns {boolean} true when the request was answered
 */
function handlePreflight(req, res) {
  if (!req || String(req.method || '').toUpperCase() !== 'OPTIONS') return false;
  sendJson(res, 204, null);
  return true;
}

/**
 * Wrap a handler so every unexpected error becomes a 500 JSON response.
 *
 * @param {Function} handler
 * @returns {Function}
 */
function withErrorHandling(handler) {
  return async function wrapped(req, res) {
    try {
      if (handlePreflight(req, res)) return undefined;
      return await handler(req, res);
    } catch (err) {
      const message = (err && err.message) || 'Lỗi không xác định';
      sendError(res, 500, message);
      return undefined;
    }
  };
}

module.exports = {
  BASE_HEADERS,
  requestUrl,
  getQuery,
  readJsonBody,
  sendJson,
  sendText,
  sendBinary,
  sendError,
  handlePreflight,
  withErrorHandling,
};
