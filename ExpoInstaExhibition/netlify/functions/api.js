// Netlify Function: runs the same /api handlers as server.js (website scan, chat, retrieve, saved designs) without a long-running server.
process.env.DATA_DIR = process.env.DATA_DIR || '/tmp/expo-data';   // functions can only write to /tmp
const { Readable } = require('node:stream');
const { handler: app } = require('../../server.js');

exports.handler = async (event) => {
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;
  const path = (event.rawUrl ? new URL(event.rawUrl).pathname : event.path || '').replace(/^\/\.netlify\/functions\/api/, '/api');
  const qs = event.rawQuery ? '?' + event.rawQuery : '';
  const body = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : null;
  const req = Readable.from(body ? [body] : []);
  Object.assign(req, { method: event.httpMethod, url: path + qs, headers: { host: headers.host || 'localhost', ...headers }, socket: { remoteAddress: headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '' } });
  return await new Promise((resolve) => {
    const out = { statusCode: 200, headers: {}, chunks: [] };
    const res = {
      setHeader: (k, v) => { out.headers[k] = v; },
      getHeader: k => out.headers[k],
      writeHead: (code, h) => { out.statusCode = code; Object.assign(out.headers, h || {}); return res; },
      write: c => { out.chunks.push(Buffer.from(c)); return true; },
      end: c => { if (c) out.chunks.push(Buffer.from(c)); const buf = Buffer.concat(out.chunks); resolve({ statusCode: out.statusCode, headers: out.headers, body: buf.toString('base64'), isBase64Encoded: true }); },
    };
    Promise.resolve(app(req, res)).catch(e => resolve({ statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: e.message }) }));
  });
};
