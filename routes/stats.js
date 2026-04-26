const { Router } = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = Router();
router.use(requireAdmin);

const PER_PAGE = 40;

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);

  const totalViewsRow = db.prepare('SELECT COALESCE(SUM(view_count), 0) AS s FROM faqs').get();
  const totalViews = totalViewsRow.s;
  const faqCount = db.prepare('SELECT COUNT(*) AS c FROM faqs').get().c;
  const logTotal = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
  const logs24h = db
    .prepare(
      `SELECT COUNT(*) AS c FROM audit_logs
       WHERE datetime(created_at) >= datetime('now', '-1 day')`
    )
    .get().c;

  const topFaqs = db
    .prepare(
      `SELECT id, title, view_count FROM faqs
       ORDER BY view_count DESC, id DESC LIMIT 25`
    )
    .all();

  const offset = (page - 1) * PER_PAGE;
  const logs = db
    .prepare(
      `SELECT * FROM audit_logs
       ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(PER_PAGE, offset);

  const totalPages = Math.max(1, Math.ceil(logTotal / PER_PAGE));

  res.render('stats', {
    title: '统计与操作日志',
    totalViews,
    faqCount,
    logTotal,
    logs24h,
    topFaqs,
    logs,
    page,
    totalPages,
    perPage: PER_PAGE,
  });
});

module.exports = router;
