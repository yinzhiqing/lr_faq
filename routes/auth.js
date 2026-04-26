const { Router } = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: '登录 - 产品知识库', error: null, returnUrl: req.query.return || '' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { title: '登录 - 产品知识库', error: '用户名或密码错误', returnUrl: req.body.return || '' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  const returnUrl = req.body.return || '/';
  res.redirect(returnUrl);
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
