const { getGuestModules } = require('../lib/siteSettings');

function guestModuleForPath(path) {
  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/faqs')) return 'faqs';
  if (path.startsWith('/files/')) return 'files';
  if (path.startsWith('/uploads/')) return 'files';
  return null;
}

function exposeGuestAccess(req, res, next) {
  const guestModules = getGuestModules();
  res.locals.guestModules = guestModules;
  res.locals.guestPublicLockedDown = !guestModules.home && !guestModules.faqs && !guestModules.files;
  next();
}

function guestAccessGuard(req, res, next) {
  if (req.session && req.session.user) return next();

  const p = req.path || '';
  if (p.startsWith('/auth/')) return next();

  const modules = getGuestModules();
  const mod = guestModuleForPath(p);
  if (mod && modules[mod]) return next();

  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return res.redirect('/auth/login?return=' + encodeURIComponent(req.originalUrl));
  }
  res.status(401).type('text/plain; charset=utf-8').send('需要登录');
}

module.exports = { exposeGuestAccess, guestAccessGuard, guestModuleForPath };
