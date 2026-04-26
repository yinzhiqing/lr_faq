const { Router } = require('express');
const db = require('../db/database');
const { logAudit } = require('../lib/auditLog');

const router = Router();

function buildTree(rows) {
  const map = {};
  const roots = [];
  for (const r of rows) {
    map[r.id] = { ...r, children: [] };
  }
  for (const r of rows) {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  }
  return roots;
}

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, p.name as product_name
    FROM categories c LEFT JOIN products p ON c.product_id = p.id
    ORDER BY c.name
  `).all();
  const tree = buildTree(rows);
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  res.render('categories', { tree, breadcrumbs: [], current: null, products });
});

router.post('/', (req, res) => {
  const { name, parent_id, product_id, description } = req.body;
  const r = db
    .prepare('INSERT INTO categories (name, parent_id, product_id, description) VALUES (?, ?, ?, ?)')
    .run(name, parent_id || null, product_id || null, description || '');
  logAudit(req, {
    action: 'category.create',
    entityType: 'category',
    entityId: r.lastInsertRowid,
    detail: { name },
  });
  res.redirect('/categories');
});

router.get('/:id/edit', (req, res) => {
  const current = db.prepare(`
    SELECT c.*, p.name as product_name FROM categories c
    LEFT JOIN products p ON c.product_id = p.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!current) return res.status(404).send('分类不存在');
  const rows = db.prepare('SELECT c.*, p.name as product_name FROM categories c LEFT JOIN products p ON c.product_id = p.id ORDER BY c.name').all();
  const tree = buildTree(rows);
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  res.render('categories', { tree, current, breadcrumbs: [], products });
});

router.post('/:id/edit', (req, res) => {
  const { name, parent_id, product_id, description } = req.body;
  db.prepare('UPDATE categories SET name=?, parent_id=?, product_id=?, description=? WHERE id=?').run(
    name, parent_id || null, product_id || null, description || '', req.params.id
  );
  logAudit(req, {
    action: 'category.update',
    entityType: 'category',
    entityId: Number(req.params.id),
    detail: { name },
  });
  res.redirect('/categories');
});

router.post('/:id/delete', (req, res) => {
  const row = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/categories');
  db.prepare('UPDATE faqs SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  logAudit(req, {
    action: 'category.delete',
    entityType: 'category',
    entityId: row.id,
    detail: { name: row.name },
  });
  res.redirect('/categories');
});

module.exports = router;
