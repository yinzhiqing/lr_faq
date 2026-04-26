const { Router } = require('express');
const db = require('../db/database');
const { requireAdminOrSupport } = require('../middleware/auth');

const router = Router();
router.use(requireAdminOrSupport);

const PER_PAGE = 40;

router.get('/history', (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const q = (typeof req.query.q === 'string' ? req.query.q.trim() : '').slice(0, 200);
  const offset = (page - 1) * PER_PAGE;

  let total;
  let rows;
  if (q) {
    const like = `%${q}%`;
    total = db
      .prepare(
        'SELECT COUNT(*) AS c FROM chat_messages m WHERE m.username LIKE ? OR m.text LIKE ?'
      )
      .get(like, like).c;
    rows = db
      .prepare(
        `SELECT m.id, m.kind, m.user_id AS user_id, m.username, m.text, m.created_at
         FROM chat_messages m
         WHERE m.username LIKE ? OR m.text LIKE ?
         ORDER BY m.id DESC LIMIT ? OFFSET ?`
      )
      .all(like, like, PER_PAGE, offset);
  } else {
    total = db.prepare('SELECT COUNT(*) AS c FROM chat_messages').get().c;
    rows = db
      .prepare(
        `SELECT m.id, m.kind, m.user_id AS user_id, m.username, m.text, m.created_at
         FROM chat_messages m
         ORDER BY m.id DESC LIMIT ? OFFSET ?`
      )
      .all(PER_PAGE, offset);
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  res.render('chat-history', {
    title: '聊天记录',
    rows,
    page,
    perPage: PER_PAGE,
    total,
    totalPages,
    query: { q },
  });
});

module.exports = router;
