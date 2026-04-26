// Require admin role
function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login?return=' + encodeURIComponent(req.originalUrl));
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('403', { title: '无权限' });
  }
  res.locals.currentUser = req.session.user;
  next();
}

function requireAdminOrSupport(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login?return=' + encodeURIComponent(req.originalUrl));
  }
  const role = req.session.user.role;
  if (role !== 'admin' && role !== 'support') {
    return res.status(403).render('403', { title: '无权限' });
  }
  res.locals.currentUser = req.session.user;
  next();
}

// Require login (any role)
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login?return=' + encodeURIComponent(req.originalUrl));
  }
  res.locals.currentUser = req.session.user;
  next();
}

// Expose user to all views (even unauthenticated)
function exposeUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

module.exports = { requireAdmin, requireAdminOrSupport, requireLogin, exposeUser };
