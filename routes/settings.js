const { Router } = require('express');
const { requireAdmin } = require('../middleware/auth');
const { getGuestModules, getWatermarkSettings, setGuestModules, setWatermarkSettings } = require('../lib/siteSettings');
const { logAudit } = require('../lib/auditLog');

const router = Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.render('settings', {
    title: '系统设置',
    guestModules: getGuestModules(),
    watermark: getWatermarkSettings(),
    saved: req.query.saved === '1',
  });
});

router.post('/guest-modules', (req, res) => {
  setGuestModules({
    home: req.body.guest_home === '1',
    faqs: req.body.guest_faqs === '1',
    files: req.body.guest_files === '1',
  });
  logAudit(req, {
    action: 'settings.guest_modules',
    entityType: 'settings',
    detail: getGuestModules(),
  });
  res.redirect('/settings?saved=1');
});

router.post('/watermark', (req, res) => {
  setWatermarkSettings({
    enabled: req.body.watermark_enabled === '1',
    text: req.body.watermark_text,
    lightOpacity: req.body.watermark_light_opacity,
    darkOpacity: req.body.watermark_dark_opacity,
    fontSize: req.body.watermark_font_size,
    rotate: req.body.watermark_rotate,
    tileWidth: req.body.watermark_tile_width,
    tileHeight: req.body.watermark_tile_height,
  });
  logAudit(req, {
    action: 'settings.watermark',
    entityType: 'settings',
    detail: getWatermarkSettings(),
  });
  res.redirect('/settings?saved=1');
});

module.exports = router;
