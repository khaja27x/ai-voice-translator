const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ROOT = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

async function translate(text, source, target) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: `Translate the following spoken sentence from ${source} to ${target}. Return only the natural translation, with no explanation. Preserve names, numbers, intent, and conversational tone.\n\n${text}`
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Translation service error: ${response.status} ${details}`);
  }

  const data = await response.json();
  const output = data.output_text || data.output?.flatMap(item => item.content || [])
    ?.filter(item => item.type === 'output_text')
    ?.map(item => item.text)
    ?.join('') || '';

  if (!output) throw new Error('The translation service returned no text.');
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
