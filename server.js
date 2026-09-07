const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MAX_BODY = 100_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const LANGUAGE_CODES = new Set(['en', 'te', 'hi', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa']);

function send(res, status, payload, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(typeof payload === 'string' || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY) {
        reject(new Error('Request is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

async function translate(text, source, target) {
  const sourceCode = String(source || '').split('-')[0].toLowerCase();
  const targetCode = String(target || '').split('-')[0].toLowerCase();

  if (!LANGUAGE_CODES.has(sourceCode) || !LANGUAGE_CODES.has(targetCode)) {
    throw new Error('Unsupported language code.');
  }
  if (sourceCode === targetCode) return text;

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text.slice(0, 4000));
  url.searchParams.set('langpair', `${sourceCode}|${targetCode}`);

  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`Translation service returned ${response.status}.`);
  const data = await response.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error(data?.responseDetails || 'No translation was returned.');
  return translated.trim();
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/translate') {
    try {
      const { text, source, target } = await readJson(req);
      if (typeof text !== 'string' || !text.trim()) return send(res, 400, { error: 'Text is required.' });
      if (!source || !target) return send(res, 400, { error: 'Source and target languages are required.' });
      const translation = await translate(text.trim(), source, target);
      return send(res, 200, { translation });
    } catch (error) {
      console.error(error);
      return send(res, 500, { error: error.message || 'Translation failed.' });
    }
  }

  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  const requested = pathname === '/' ? '/index.html' : pathname;
  const relative = path.normalize(requested).replace(/^([/\\])+/, '');
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) return send(res, 403, { error: 'Forbidden.' });

  fs.readFile(filePath, (error, content) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    send(res, 200, content, MIME[path.extname(filePath)] || 'application/octet-stream');
  });
});

server.listen(PORT, () => console.log(`MediTranslate running at http://localhost:${PORT}`));
