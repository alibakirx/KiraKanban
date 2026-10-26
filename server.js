const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3456;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Klasörleri hazırla
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Varsayılan başlangıç verisi
const defaultData = {
  projects: [
    { id: 'proj-1', name: 'Kira Web App', color: '#B45309' },
    { id: 'proj-2', name: 'Mobil Uygulama', color: '#0F766E' },
    { id: 'proj-3', name: 'Backend API', color: '#4338CA' }
  ],
  tasks: [
    {
      id: 'task-1',
      code: 'KR-1',
      title: 'Kira Kanban panosunu keşfet ve ilk işini ekle',
      description: 'Bu örnek bir iş kartıdır. Kartın üzerine tıklayarak detayları görebilir, alt görevler (checklist) ekleyebilir, not bırakabilir veya doğrudan Ctrl+V ile ekran görüntüsü yapıştırabilirsin.',
      projectId: 'proj-1',
      status: 'planning',
      priority: 'high',
      type: 'feature',
      image: null,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: [
        { id: 'chk-1', text: 'Yeni bir proje etiketi oluştur', done: false },
        { id: 'chk-2', text: 'Kartı sürükleyip "Başlandı" sütununa taşı', done: false },
        { id: 'chk-3', text: 'Bu karta bir not ekle', done: true }
      ],
      notes: [
        {
          id: 'note-1',
          text: 'Krem tema ve yerel veritabanı sistemi aktif edildi. Tüm veriler otomatik olarak data/db.json klasörüne kaydediliyor.',
          createdAt: new Date().toISOString()
        }
      ]
    }
  ],
  counter: 1
};

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('DB okuma hatası:', err);
    return defaultData;
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  try {
    // API: Tüm verileri getir
    if (req.method === 'GET' && pathname === '/api/data') {
      const db = readDB();
      return sendJSON(res, 200, db);
    }

    // API: Veritabanını kaydet / senkronize et
    if (req.method === 'POST' && pathname === '/api/data') {
      const body = await parseBody(req);
      if (!body || !Array.isArray(body.tasks) || !Array.isArray(body.projects)) {
        return sendJSON(res, 400, { error: 'Geçersiz veri formatı' });
      }
      writeDB({
        projects: body.projects,
        tasks: body.tasks,
        counter: typeof body.counter === 'number' ? body.counter : body.tasks.length
      });
      return sendJSON(res, 200, { ok: true });
    }

    // API: Resim yükle (Base64 data URL -> data/uploads/ dosyası)
    if (req.method === 'POST' && pathname === '/api/upload') {
      const body = await parseBody(req);
      if (!body || !body.dataUrl) {
        return sendJSON(res, 400, { error: 'Görsel verisi bulunamadı' });
      }
      const matches = body.dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches) {
        return sendJSON(res, 400, { error: 'Geçersiz görsel formatı' });
      }
      let ext = matches[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      if (ext === 'svg+xml') ext = 'svg';
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(filePath, buffer);
      return sendJSON(res, 200, { url: `/uploads/${fileName}` });
    }

    // Yüklenen görselleri sun
    if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
      const fileName = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Görsel bulunamadı');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Statik dosyaları sun (public klasörü)
    let safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(PUBLIC_DIR, path.normalize(safePath).replace(/^(\.\.[\/\\])+/, ''));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Sayfa bulunamadı');
  } catch (err) {
    console.error('Sunucu hatası:', err);
    sendJSON(res, 500, { error: 'Sunucu hatası oluştu', details: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  Kira - Proje & İş Takip Uygulaması Çalışıyor!`);
  console.log(`  Adres: http://localhost:${PORT}`);
  console.log(`  Veriler: ${DB_FILE}`);
  console.log(`==================================================\n`);
});
