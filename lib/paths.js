const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : root;

const dbPath = process.env.DATA_DIR
  ? path.join(dataDir, 'faq.db')
  : path.join(root, 'db', 'faq.db');

const uploadDir = process.env.DATA_DIR
  ? path.join(dataDir, 'uploads')
  : path.join(root, 'uploads');

function ensureDataDirs() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
}

ensureDataDirs();

module.exports = { root, dataDir, dbPath, uploadDir };
