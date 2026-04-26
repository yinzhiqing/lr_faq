const { Router } = require('express');
const db = require('../db/database');
const { logAudit } = require('../lib/auditLog');

const router = Router();

router.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, COUNT(f.id) as faq_count
    FROM products p
    LEFT JOIN faqs f ON f.product_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `).all();
  res.render('products', { products, current: null });
});

router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (name && name.trim()) {
    const r = db.prepare('INSERT INTO products (name, description) VALUES (?, ?)').run(name.trim(), description || '');
    logAudit(req, {
      action: 'product.create',
      entityType: 'product',
      entityId: r.lastInsertRowid,
      detail: { name: name.trim() },
    });
  }
  res.redirect('/products');
});

router.get('/:id/edit', (req, res) => {
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).send('产品不存在');
  const products = db.prepare(`
    SELECT p.*, COUNT(f.id) as faq_count
    FROM products p
    LEFT JOIN faqs f ON f.product_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `).all();
  res.render('products', { products, current });
});

router.post('/:id/edit', (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE products SET name = ?, description = ? WHERE id = ?').run(
    name.trim(), description || '', req.params.id
  );
  logAudit(req, {
    action: 'product.update',
    entityType: 'product',
    entityId: Number(req.params.id),
    detail: { name: name.trim() },
  });
  res.redirect('/products');
});

router.post('/:id/delete', (req, res) => {
  const row = db.prepare('SELECT id, name FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/products');
  db.prepare('UPDATE faqs SET product_id = NULL WHERE product_id = ?').run(req.params.id);
  db.prepare('UPDATE categories SET product_id = NULL WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  logAudit(req, {
    action: 'product.delete',
    entityType: 'product',
    entityId: row.id,
    detail: { name: row.name },
  });
  res.redirect('/products');
});

module.exports = router;
