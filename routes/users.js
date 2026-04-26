const { Router } = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = Router();
router.use(requireAdmin);

const ROLES = new Set(['admin', 'user', 'support']);

function normalizeRole(role) {
  return ROLES.has(role) ? role : 'user';
}

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.render('users', { users, current: null, error: null });
});

router.post('/', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !username.trim() || !password) {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    return res.render('users', { users, current: null, error: '用户名和密码不能为空' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    return res.render('users', { users, current: null, error: '用户名已存在' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
    username.trim(),
    hash,
    normalizeRole(role)
  );
  res.redirect('/users');
});

router.get('/:id/edit', (req, res) => {
  const current = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).send('用户不存在');
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.render('users', { users, current, error: null });
});

router.post('/:id/edit', (req, res) => {
  const { username, password, role } = req.body;
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).send('用户不存在');

  const r = normalizeRole(role);
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?').run(
      username.trim(), hash, r, req.params.id
    );
  } else {
    db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(
      username.trim(), r, req.params.id
    );
  }
  res.redirect('/users');
});

router.post('/:id/delete', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).send('用户不存在');
  if (user.username === 'admin') {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    return res.render('users', { users, current: null, error: '不能删除默认管理员账号' });
  }
  if (String(user.id) === String(req.session.user.id)) {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    return res.render('users', { users, current: null, error: '不能删除自己' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.redirect('/users');
});

module.exports = router;
