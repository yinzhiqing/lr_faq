const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdminOrSupport } = require('../middleware/auth');
const { logAudit } = require('../lib/auditLog');

const router = Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

router.get('/:id/view', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).send('文件不存在');
  const filePath = path.join(uploadDir, file.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('文件已被删除');
  res.sendFile(filePath);
});

router.get('/:id/download', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).send('文件不存在');
  const filePath = path.join(uploadDir, file.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('文件已被删除');
  res.download(filePath, file.original_name);
});

router.post('/:id/delete', requireAdminOrSupport, (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).send('文件不存在');
  const filePath = path.join(uploadDir, file.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  logAudit(req, {
    action: 'file.delete',
    entityType: 'file',
    entityId: file.id,
    detail: { original_name: file.original_name, faq_id: file.faq_id },
  });
  res.redirect(`/faqs/${file.faq_id}`);
});

module.exports = router;
