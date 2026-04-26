const { Router } = require('express');
const db = require('../db/database');
const { logAudit } = require('../lib/auditLog');

const router = Router();

router.get('/', (req, res) => {
  const tags = db.prepare(`
    SELECT t.*, COUNT(ft.faq_id) as faq_count
    FROM tags t
    LEFT JOIN faq_tags ft ON t.id = ft.tag_id
    GROUP BY t.id
    ORDER BY t.name
  `).all();
  res.render('tags', { tags, current: null });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.redirect('/tags');
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim());
  if (!existing) {
    const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name.trim());
    logAudit(req, {
      action: 'tag.create',
      entityType: 'tag',
      entityId: r.lastInsertRowid,
      detail: { name: name.trim() },
    });
  }
  res.redirect('/tags');
});

router.get('/:id/edit', (req, res) => {
  const current = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).send('标签不存在');
  const tags = db.prepare(`
    SELECT t.*, COUNT(ft.faq_id) as faq_count
    FROM tags t
    LEFT JOIN faq_tags ft ON t.id = ft.tag_id
    GROUP BY t.id
    ORDER BY t.name
  `).all();
  res.render('tags', { tags, current });
});

router.post('/:id/edit', (req, res) => {
  const { name } = req.body;
  if (name && name.trim()) {
    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    logAudit(req, {
      action: 'tag.update',
      entityType: 'tag',
      entityId: Number(req.params.id),
      detail: { name: name.trim() },
    });
  }
  res.redirect('/tags');
});

router.post('/:id/delete', (req, res) => {
  const row = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/tags');
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  logAudit(req, {
    action: 'tag.delete',
    entityType: 'tag',
    entityId: row.id,
    detail: { name: row.name },
  });
  res.redirect('/tags');
});

module.exports = router;
