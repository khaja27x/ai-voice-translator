require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    return res.end(data);
  }
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

async function translate(text, source, target) {
  const sourceCode = source.split('-')[0].toLowerCase();
  const targetCode = target.split('-')[0].toLowerCase();

  if (sourceCode === targetCode) return text;

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${sourceCode}|${targetCode}`);

  const response = await fetch(url);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Free translation service error: ${response.status} ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Free translation service returned invalid JSON.');
  }

  if (data.responseStatus && Number(data.responseStatus) !== 200) {
    throw new Error(data.responseDetails || 'Free translation service rejected the request.');
  }

  const output = data.responseData?.translatedText;
  if (!output) throw new Error('The free translation service returned no text.');

  return output.trim();
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
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text, source, target } = JSON.parse(body || '{}');
        if (!text || !source || !target) return send(res, 400, { error: 'text, source and target are required.' });
        if (source === target) return send(res, 200, { translation: text });
        const translation = await translate(text, source, target);
        send(res, 200, { translation });
      } catch (error) {
        console.error('TRANSLATION ERROR:', error.message);
        send(res, 500, { error: error.message });
      }
    });
    return;
  }

  const requested = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(filePath, (error, content) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const type = mime[path.extname(filePath)] || 'application/octet-stream';
    send(res, 200, content, type);
  });
});

server.listen(PORT, () => console.log(`Voice Mediator running on http://localhost:${PORT}`));
