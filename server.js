import express from 'express';
import multer from 'multer';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('エラー: GOOGLE_API_KEY が設定されていません');
  process.exit(1);
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

// DB
const db = new Database('banano.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    parent_id TEXT,
    prompt TEXT,
    created_at TEXT NOT NULL,
    is_uploaded INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES images(id)
  )
`);

// Multer
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// API: 利用可能モデル一覧
app.get('/api/config', (req, res) => {
  const models = [{ value: 'gemini', label: 'Gemini' }];
  if (OPENAI_API_KEY) {
    models.push({ value: 'gpt-image-1', label: 'GPT Image 1' });
    models.push({ value: 'gpt-image-1.5', label: 'GPT Image 1.5' });
  }
  res.json({ models });
});

// 子孫数を取得する再帰CTE
function getDescendantCount(id) {
  const row = db.prepare(`
    WITH RECURSIVE desc(id) AS (
      SELECT id FROM images WHERE parent_id = ?
      UNION ALL
      SELECT i.id FROM images i JOIN desc d ON i.parent_id = d.id
    )
    SELECT COUNT(*) as cnt FROM desc
  `).get(id);
  return row.cnt;
}

function formatImage(row) {
  return { ...row, descendant_count: getDescendantCount(row.id) };
}

// API: 画像一覧
app.get('/api/images', (req, res) => {
  const { filter } = req.query;
  let rows;
  if (filter === 'favorites') {
    rows = db.prepare('SELECT * FROM images WHERE is_favorite = 1 ORDER BY created_at DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM images ORDER BY created_at DESC').all();
  }
  res.json(rows.map(formatImage));
});

// API: 画像詳細
app.get('/api/images/:id', (req, res) => {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!image) return res.status(404).json({ error: '画像が見つかりません' });

  const parent = image.parent_id
    ? db.prepare('SELECT * FROM images WHERE id = ?').get(image.parent_id)
    : null;
  const children = db.prepare('SELECT * FROM images WHERE parent_id = ? ORDER BY created_at DESC').all(image.id);

  res.json({
    ...formatImage(image),
    parent: parent ? formatImage(parent) : null,
    children: children.map(formatImage)
  });
});

// API: お気に入りトグル
app.post('/api/images/:id/favorite', (req, res) => {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!image) return res.status(404).json({ error: '画像が見つかりません' });
  const newVal = image.is_favorite ? 0 : 1;
  db.prepare('UPDATE images SET is_favorite = ? WHERE id = ?').run(newVal, req.params.id);
  res.json({ is_favorite: newVal });
});

// API: アップロード
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO images (id, filename, parent_id, prompt, created_at, is_uploaded) VALUES (?, ?, NULL, NULL, ?, 1)')
    .run(id, req.file.filename, now);
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  res.json(formatImage(image));
});

// OpenAI画像生成
async function generateOneOpenAI(modelName, prompt, parentFilePath, parentMimeType, aspectRatio) {
  const sizeMap = { '1:1': '1024x1024', '3:4': '1024x1536', '9:16': '1024x1536', '4:3': '1536x1024', '16:9': '1536x1024' };
  const size = sizeMap[aspectRatio] || '1024x1024';

  let resBody;
  if (parentFilePath) {
    const form = new FormData();
    form.append('model', modelName);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', size);
    const fileData = await fs.readFile(parentFilePath);
    form.append('image[]', new Blob([fileData], { type: parentMimeType }), path.basename(parentFilePath));
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: form
    });
    resBody = await res.json();
  } else {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt, n: 1, size })
    });
    resBody = await res.json();
  }

  if (resBody.error) throw new Error(resBody.error.message);
  const b64 = resBody.data[0].b64_json;
  return Buffer.from(b64, 'base64');
}

// API: 画像生成 (SSE)
app.post('/api/generate', express.json(), async (req, res) => {
  const { parent_id, prompt, count = 1, temperature = 1.0, aspect_ratio, model: modelParam } = req.body;
  if (!prompt) return res.status(400).json({ error: 'プロンプトが必要です' });

  const numCount = Math.min(Math.max(parseInt(count), 1), 20);
  const isOpenAI = modelParam && modelParam.startsWith('gpt-');

  // SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  let parentFilePath = null;
  let parentMimeType = null;
  let parentImageData = null;
  if (parent_id) {
    const parentRow = db.prepare('SELECT * FROM images WHERE id = ?').get(parent_id);
    if (parentRow) {
      parentFilePath = path.join('uploads', parentRow.filename);
      const ext = path.extname(parentRow.filename).toLowerCase().slice(1);
      parentMimeType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/jpeg';
      if (!isOpenAI) {
        const data = await fs.readFile(parentFilePath);
        parentImageData = { inlineData: { data: data.toString('base64'), mimeType: parentMimeType } };
      }
    }
  }

  let completed = 0;
  const results = [];

  const generateOne = async (index) => {
    try {
      if (isOpenAI) {
        const buf = await generateOneOpenAI(modelParam, prompt, parent_id ? parentFilePath : null, parentMimeType, aspect_ratio);
        const id = uuidv4();
        const filename = `${id}.png`;
        await fs.writeFile(path.join('uploads', filename), buf);
        const now = new Date().toISOString();
        db.prepare('INSERT INTO images (id, filename, parent_id, prompt, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(id, filename, parent_id || null, prompt, now);
        return { id, filename };
      }

      // Gemini
      const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
      const generationConfig = {};
      if (temperature !== undefined) generationConfig.temperature = parseFloat(temperature);
      if (aspect_ratio && aspect_ratio !== 'auto') generationConfig.aspectRatio = aspect_ratio;
      const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview', generationConfig });
      const fullPrompt = parentImageData
        ? `Generate an image based on this input image and the following instruction: ${prompt}\n\nIMPORTANT: Create a new image that follows the instruction while using the input image as reference.`
        : prompt;
      const parts = parentImageData ? [fullPrompt, parentImageData] : [fullPrompt];
      const result = await model.generateContent(parts);
      const response = await result.response;

      if (!response.candidates) return null;
      for (const candidate of response.candidates) {
        if (!candidate.content?.parts) continue;
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const id = uuidv4();
            const ext = part.inlineData.mimeType === 'image/png' ? '.png' : '.jpg';
            const filename = `${id}${ext}`;
            await fs.writeFile(path.join('uploads', filename), Buffer.from(part.inlineData.data, 'base64'));
            const now = new Date().toISOString();
            db.prepare('INSERT INTO images (id, filename, parent_id, prompt, created_at) VALUES (?, ?, ?, ?, ?)')
              .run(id, filename, parent_id || null, prompt, now);
            return { id, filename };
          }
        }
      }
      return null;
    } catch (e) {
      console.error(`生成エラー [${index}]:`, e.message);
      return null;
    }
  };

  // 並列生成
  const promises = Array.from({ length: numCount }, (_, i) =>
    generateOne(i + 1).then(result => {
      completed++;
      const event = { completed, total: numCount, result };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (result) results.push(result);
    })
  );

  await Promise.all(promises);
  res.write(`data: ${JSON.stringify({ done: true, results })}\n\n`);
  res.end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Banano running at http://0.0.0.0:${PORT}`);
});
