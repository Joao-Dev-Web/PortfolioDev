// Servidor sem dependências: node server.js
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const PASS = process.env.ADMIN_PASSWORD || 'troque-esta-senha';
if (!process.env.ADMIN_PASSWORD) console.warn('Aviso: defina ADMIN_PASSWORD para usar uma senha própria.');
const DATA = path.join(__dirname, 'content.json'), UP = path.join(__dirname, 'uploads');
fs.mkdirSync(UP, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg' };
const fails = new Map();

const auth = (req, res) => {
  const ip = req.socket.remoteAddress, f = fails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 10) { send(res, 429, { error: 'tente mais tarde' }); return false; }
  const a = Buffer.from(String(req.headers['x-admin-password'] || '')), b = Buffer.from(PASS);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  f.n++; fails.set(ip, f); send(res, 401, { error: 'senha incorreta' }); return false;
};
const send = (res, code, body, type = 'application/json; charset=utf-8', cache = 'no-store') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': cache });
  res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
};
const body = (req, max) => new Promise((ok, bad) => {
  const c = []; let n = 0;
  req.on('data', d => { n += d.length; if (n > max) { bad(new Error('grande')); req.destroy(); } else c.push(d); });
  req.on('end', () => ok(Buffer.concat(c))); req.on('error', bad);
});
const file = (res, f, type, cache) => fs.readFile(f, (e, d) => e ? send(res, 404, { error: 'não encontrado' }) : send(res, 200, d, type, cache));

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (req.method === 'GET') {
      if (url === '/admin/') { res.writeHead(301, { Location: '/admin' }); return res.end(); }
      if (url === '/' || url === '/admin') return file(res, path.join(__dirname, 'index.html'), TYPES['.html'], 'no-cache');
      if (url === '/style.css' || url === '/script.js') return file(res, path.join(__dirname, url), TYPES[path.extname(url)], 'no-cache');
      if (url === '/content.json') return file(res, DATA, TYPES['.json'], 'no-store');
      const m = url.match(/^\/uploads\/([\w.-]+\.jpg)$/);
      if (m) return file(res, path.join(UP, m[1]), TYPES['.jpg'], 'public, max-age=31536000');
      return send(res, 404, { error: 'não encontrado' });
    }
    if (req.method === 'POST' && url === '/api/login') { if (auth(req, res)) send(res, 200, { ok: true }); return; }
    if (req.method === 'POST' && url === '/api/save') {
      if (!auth(req, res)) return;
      const d = JSON.parse((await body(req, 5e6)).toString('utf8'));
      if (!Array.isArray(d) || !d.every(x => typeof x.title === 'string' && typeof x.strip === 'string')) return send(res, 400, { error: 'formato inválido' });
      if (fs.existsSync(DATA)) fs.copyFileSync(DATA, DATA.replace('.json', '.bak.json'));
      fs.writeFileSync(DATA + '.tmp', JSON.stringify(d)); fs.renameSync(DATA + '.tmp', DATA);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url === '/api/upload') {
      if (!auth(req, res)) return;
      if (req.headers['content-type'] !== 'image/jpeg') return send(res, 415, { error: 'envie JPEG' });
      const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.jpg';
      fs.writeFileSync(path.join(UP, name), await body(req, 8e6));
      return send(res, 200, { url: 'uploads/' + name });
    }
    send(res, 404, { error: 'não encontrado' });
  } catch (e) { send(res, 400, { error: 'requisição inválida' }); }
}).listen(PORT, () => console.log(`Site: http://localhost:${PORT}   Edição: http://localhost:${PORT}/admin`));
