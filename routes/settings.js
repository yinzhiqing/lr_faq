const { Router } = require('express');
const { requireAdmin } = require('../middleware/auth');
const { getGuestModules, setGuestModules } = require('../lib/siteSettings');

const router = Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.render('settings', {
    title: '系统设置',
    guestModules: getGuestModules(),
    saved: req.query.saved === '1',
  });
});

router.post('/guest-modules', (req, res) => {
  setGuestModules({
    home: req.body.guest_home === '1',
    faqs: req.body.guest_faqs === '1',
    files: req.body.guest_files === '1',
  });
  res.redirect('/settings?saved=1');
});

module.exports = router;
