const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { processVideo } = require('../services/transcode');

const router = Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// List & search
router.get('/', (req, res) => {
  const { q, product, category, tag } = req.query;
  let sql = `SELECT DISTINCT f.*, p.name as product_name, c.name as category_name
    FROM faqs f
    LEFT JOIN products p ON f.product_id = p.id
    LEFT JOIN categories c ON f.category_id = c.id`;
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(f.title LIKE ? OR f.question LIKE ? OR f.answer LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (product) {
    conditions.push('f.product_id = ?');
    params.push(product);
  }
  if (category) {
    conditions.push('f.category_id = ?');
    params.push(category);
  }
  if (tag) {
    sql += ' JOIN faq_tags ft ON f.id = ft.faq_id';
    conditions.push('ft.tag_id = ?');
    params.push(tag);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY f.updated_at DESC';

  const faqs = db.prepare(sql).all(...params);
  const stmtTags = db.prepare('SELECT t.* FROM tags t JOIN faq_tags ft ON t.id = ft.tag_id WHERE ft.faq_id = ?');
  for (const faq of faqs) {
    faq.tags = stmtTags.all(faq.id);
  }

  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();

  res.render('faqs', { faqs, products, categories, tags, query: req.query });
});

// New FAQ form
router.get('/new', requireAdmin, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const allTags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.render('faq-form', { faq: null, products, categories, tags: [], allTags, suggestions: null });
});

// Create FAQ
router.post('/', requireAdmin, upload.array('files', 10), (req, res) => {
  const { title, question, answer, product_id, category_id, tag_ids } = req.body;
  const result = db.prepare(
    'INSERT INTO faqs (title, question, answer, product_id, category_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, question, answer || '', product_id || null, category_id || null);
  const faqId = result.lastInsertRowid;

  if (tag_ids) {
    const ids = Array.isArray(tag_ids) ? tag_ids : [tag_ids];
    const insert = db.prepare('INSERT OR IGNORE INTO faq_tags (faq_id, tag_id) VALUES (?, ?)');
    for (const tid of ids) insert.run(faqId, tid);
  }

  // Save uploaded files, transcode video if needed
  if (req.files) {
    const insertFile = db.prepare('INSERT INTO files (filename, original_name, mime_type, size, faq_id) VALUES (?, ?, ?, ?, ?)');
    for (const f of req.files) {
      let fileSize = f.size;
      if (f.mimetype && f.mimetype.startsWith('video/')) {
        fileSize = processVideo(path.join(uploadDir, f.filename));
      }
      insertFile.run(f.filename, f.originalname, f.mimetype, fileSize, faqId);
    }
  }

  res.redirect(`/faqs/${faqId}`);
});

// Auto-classify API
router.get('/api/classify/suggest', (req, res) => {
  const { title, question, filename } = req.query;
  const { suggestFromContent, suggestFromFilename } = require('../services/classifier');
  let result;
  if (filename) {
    result = suggestFromFilename(filename);
  } else {
    result = suggestFromContent(title || '', question || '');
  }
  res.json(result);
});

// Image upload API for inline embedding
router.post('/api/upload-image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

// View FAQ detail
router.get('/:id', (req, res) => {
  const faq = db.prepare(`
    SELECT f.*, p.name as product_name, c.name as category_name
    FROM faqs f
    LEFT JOIN products p ON f.product_id = p.id
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!faq) return res.status(404).send('FAQ 不存在');

  faq.tags = db.prepare('SELECT t.* FROM tags t JOIN faq_tags ft ON t.id = ft.tag_id WHERE ft.faq_id = ?').all(faq.id);
  faq.files = db.prepare('SELECT * FROM files WHERE faq_id = ? ORDER BY created_at DESC').all(faq.id);

  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('faq-detail', { faq, products, categories });
});

// Edit FAQ form
router.get('/:id/edit', requireAdmin, (req, res) => {
  const faq = db.prepare('SELECT * FROM faqs WHERE id = ?').get(req.params.id);
  if (!faq) return res.status(404).send('FAQ 不存在');
  faq.tags = db.prepare('SELECT t.* FROM tags t JOIN faq_tags ft ON t.id = ft.tag_id WHERE ft.faq_id = ?').all(faq.id);
  faq.files = db.prepare('SELECT * FROM files WHERE faq_id = ? ORDER BY created_at DESC').all(faq.id);

  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const allTags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.render('faq-form', { faq, products, categories, tags: faq.tags, allTags, suggestions: null });
});

// Update FAQ
router.post('/:id/edit', requireAdmin, upload.array('files', 10), (req, res) => {
  const { title, question, answer, product_id, category_id, tag_ids } = req.body;
  db.prepare(`
    UPDATE faqs SET title=?, question=?, answer=?, product_id=?, category_id=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, question, answer || '', product_id || null, category_id || null, req.params.id);

  db.prepare('DELETE FROM faq_tags WHERE faq_id = ?').run(req.params.id);
  if (tag_ids) {
    const ids = Array.isArray(tag_ids) ? tag_ids : [tag_ids];
    const insert = db.prepare('INSERT OR IGNORE INTO faq_tags (faq_id, tag_id) VALUES (?, ?)');
    for (const tid of ids) insert.run(req.params.id, tid);
  }

  if (req.files && req.files.length > 0) {
    const insertFile = db.prepare('INSERT INTO files (filename, original_name, mime_type, size, faq_id) VALUES (?, ?, ?, ?, ?)');
    for (const f of req.files) {
      let fileSize = f.size;
      if (f.mimetype && f.mimetype.startsWith('video/')) {
        fileSize = processVideo(path.join(uploadDir, f.filename));
      }
      insertFile.run(f.filename, f.originalname, f.mimetype, fileSize, req.params.id);
    }
  }

  res.redirect(`/faqs/${req.params.id}`);
});

// Delete FAQ
router.post('/:id/delete', requireAdmin, (req, res) => {
  // Clean up files on disk
  const files = db.prepare('SELECT filename FROM files WHERE faq_id = ?').all(req.params.id);
  for (const f of files) {
    const fp = path.join(uploadDir, f.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
  res.redirect('/faqs');
});

module.exports = router;
