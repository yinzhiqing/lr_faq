const { Router } = require('express');
const db = require('../db/database');
const { linkifyChatText } = require('../lib/linkifyChatText');
const { requireAdminOrSupport } = require('../middleware/auth');

const router = Router();
router.use(requireAdminOrSupport);

const PER_PAGE = 40;

function plainExcerpt(markdown, maxLen) {
  if (!markdown) return '';
  let s = String(markdown);
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/\[(.*?)\]\(([^)]+)\)/g, '$1');
  s = s.replace(/[*_>|]/g, '');
  s = s.replace(/\n+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) return `${s.slice(0, maxLen - 1)}…`;
  return s;
}

router.get('/api/kb-search', (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q.trim() : '').slice(0, 100);
  if (!q) {
    return res.json({ faqs: [] });
  }
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT f.id, f.title, f.question, f.answer
       FROM faqs f
       WHERE f.title LIKE ? OR f.question LIKE ? OR f.answer LIKE ?
       ORDER BY f.updated_at DESC
       LIMIT 15`
    )
    .all(like, like, like);

  const faqs = rows.map((r) => ({
    id: r.id,
    title: r.title,
    question: r.question,
    excerpt: plainExcerpt(r.answer ? r.answer.slice(0, 800) : '', 420),
    path: `/faqs/${r.id}`,
  }));

  res.json({ faqs });
});

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
    linkifyChatText,
  });
});

module.exports = router;
