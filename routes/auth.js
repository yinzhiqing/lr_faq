const { Router } = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../lib/auditLog');

const router = Router();

function renderChangePassword(req, res, opts) {
  res.render('change-password', {
    title: '修改密码',
    error: opts.error != null ? opts.error : null,
    saved: Boolean(opts.saved),
  });
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', {
    layout: 'layout-login',
    title: '登录 - 产品知识库',
    error: null,
    returnUrl: req.query.return || '',
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    logAudit(req, {
      action: 'auth.login_failed',
      username: (username || '').trim() || null,
      detail: { username: (username || '').trim() },
    });
    return res.render('login', {
      layout: 'layout-login',
      title: '登录 - 产品知识库',
      error: '用户名或密码错误',
      returnUrl: req.body.return || '',
    });
  }
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name != null ? String(user.full_name) : '',
  };
  logAudit(req, { action: 'auth.login' });
  const returnUrl = req.body.return || '/';
  res.redirect(returnUrl);
});

router.get('/logout', (req, res) => {
  if (req.session.user) logAudit(req, { action: 'auth.logout' });
  req.session.destroy(() => {
    res.redirect('/');
  });
});

router.get('/change-password', requireLogin, (req, res) => {
  renderChangePassword(req, res, { saved: req.query.saved === '1' });
});

router.post('/change-password', requireLogin, (req, res) => {
  const { current_password, new_password, new_password_confirm } = req.body;
  const uid = req.session.user.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (!user) {
    return res.redirect('/auth/logout');
  }

  if (!current_password || !new_password || !new_password_confirm) {
    return renderChangePassword(req, res, { error: '请填写所有字段' });
  }
  if (!bcrypt.compareSync(current_password, user.password)) {
    return renderChangePassword(req, res, { error: '当前密码不正确' });
  }
  if (String(new_password).length < 6) {
    return renderChangePassword(req, res, { error: '新密码至少 6 位' });
  }
  if (new_password !== new_password_confirm) {
    return renderChangePassword(req, res, { error: '两次输入的新密码不一致' });
  }
  if (new_password === current_password) {
    return renderChangePassword(req, res, { error: '新密码不能与当前密码相同' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, uid);
  logAudit(req, {
    action: 'auth.password_change',
    entityType: 'user',
    entityId: uid,
    detail: { username: user.username },
  });
  res.redirect('/auth/change-password?saved=1');
});

module.exports = router;
