const db = require('../db/database');

const MODULE_KEYS = {
  home: 'guest_module_home',
  faqs: 'guest_module_faqs',
  files: 'guest_module_files',
};

function readFlag(key) {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  return !!(row && row.value === '1');
}

function getGuestModules() {
  try {
    return {
      home: readFlag(MODULE_KEYS.home),
      faqs: readFlag(MODULE_KEYS.faqs),
      files: readFlag(MODULE_KEYS.files),
    };
  } catch {
    return { home: true, faqs: true, files: true };
  }
}

function setGuestModules({ home, faqs, files }) {
  const upsert = db.prepare(
    `INSERT INTO site_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  upsert.run(MODULE_KEYS.home, home ? '1' : '0');
  upsert.run(MODULE_KEYS.faqs, faqs ? '1' : '0');
  upsert.run(MODULE_KEYS.files, files ? '1' : '0');
}

module.exports = { getGuestModules, setGuestModules };
