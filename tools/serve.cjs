const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep) || !['.js', '.css', '.html'].includes(path.extname(file)) || !['GET','HEAD'].includes(req.method)) { res.writeHead(404).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': ({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)] + '; charset=utf-8', 'Cache-Control':'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(Number(process.env.TIDE_PORT || 57372), '127.0.0.1', () => console.log('Gelgit: http://127.0.0.1:' + (process.env.TIDE_PORT || 57372)));
