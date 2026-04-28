const db = require('../db/database');

const MODULE_KEYS = {
  home: 'guest_module_home',
  faqs: 'guest_module_faqs',
  files: 'guest_module_files',
};

const WATERMARK_KEYS = {
  enabled: 'watermark_enabled',
  text: 'watermark_text',
  lightOpacity: 'watermark_light_opacity',
  darkOpacity: 'watermark_dark_opacity',
  fontSize: 'watermark_font_size',
  rotate: 'watermark_rotate',
  tileWidth: 'watermark_tile_width',
  tileHeight: 'watermark_tile_height',
};

const DEFAULT_WATERMARK = {
  enabled: true,
  text: '北京龙软科技',
  lightOpacity: 0.055,
  darkOpacity: 0.06,
  fontSize: 42,
  rotate: -24,
  tileWidth: 820,
  tileHeight: 500,
};

function readFlag(key) {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  return !!(row && row.value === '1');
}

function readValue(key) {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function clampNumber(value, fallback, min, max, digits = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(max, Math.max(min, num));
  return digits > 0 ? Number(clamped.toFixed(digits)) : Math.round(clamped);
}

function normalizeWatermarkText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || DEFAULT_WATERMARK.text;
}

function buildWatermarkTile(text, fill, opacity, fontSize, rotate, width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${Math.round(width / 2)}" y="${Math.round(height / 2) + Math.round(fontSize / 2)}" fill="${fill}" fill-opacity="${opacity}" font-size="${fontSize}" font-family="Inter,Noto Sans SC,PingFang SC,sans-serif" transform="rotate(${rotate} ${Math.round(width / 2)} ${Math.round(height / 2)})" text-anchor="middle">${text}</text></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
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

function getWatermarkSettings() {
  try {
    const text = normalizeWatermarkText(readValue(WATERMARK_KEYS.text));
    const fontSize = clampNumber(readValue(WATERMARK_KEYS.fontSize), DEFAULT_WATERMARK.fontSize, 12, 120);
    const tileWidth = clampNumber(readValue(WATERMARK_KEYS.tileWidth), DEFAULT_WATERMARK.tileWidth, 240, 2400);
    const tileHeight = clampNumber(readValue(WATERMARK_KEYS.tileHeight), DEFAULT_WATERMARK.tileHeight, 160, 1600);
    const rotate = clampNumber(readValue(WATERMARK_KEYS.rotate), DEFAULT_WATERMARK.rotate, -89, 89);
    const lightOpacity = clampNumber(readValue(WATERMARK_KEYS.lightOpacity), DEFAULT_WATERMARK.lightOpacity, 0.01, 0.3, 3);
    const darkOpacity = clampNumber(readValue(WATERMARK_KEYS.darkOpacity), DEFAULT_WATERMARK.darkOpacity, 0.01, 0.3, 3);
    const enabledValue = readValue(WATERMARK_KEYS.enabled);
    const enabled = enabledValue === null ? DEFAULT_WATERMARK.enabled : enabledValue === '1';
    return {
      enabled,
      text,
      lightOpacity,
      darkOpacity,
      fontSize,
      rotate,
      tileWidth,
      tileHeight,
      lightTile: buildWatermarkTile(text, '#1d1d1f', lightOpacity, fontSize, rotate, tileWidth, tileHeight),
      darkTile: buildWatermarkTile(text, '#f5f5f7', darkOpacity, fontSize, rotate, tileWidth, tileHeight),
    };
  } catch {
    const fallback = { ...DEFAULT_WATERMARK };
    return {
      ...fallback,
      lightTile: buildWatermarkTile(
        fallback.text,
        '#1d1d1f',
        fallback.lightOpacity,
        fallback.fontSize,
        fallback.rotate,
        fallback.tileWidth,
        fallback.tileHeight
      ),
      darkTile: buildWatermarkTile(
        fallback.text,
        '#f5f5f7',
        fallback.darkOpacity,
        fallback.fontSize,
        fallback.rotate,
        fallback.tileWidth,
        fallback.tileHeight
      ),
    };
  }
}

function setWatermarkSettings(input) {
  const settings = {
    enabled: !!input.enabled,
    text: normalizeWatermarkText(input.text),
    lightOpacity: clampNumber(input.lightOpacity, DEFAULT_WATERMARK.lightOpacity, 0.01, 0.3, 3),
    darkOpacity: clampNumber(input.darkOpacity, DEFAULT_WATERMARK.darkOpacity, 0.01, 0.3, 3),
    fontSize: clampNumber(input.fontSize, DEFAULT_WATERMARK.fontSize, 12, 120),
    rotate: clampNumber(input.rotate, DEFAULT_WATERMARK.rotate, -89, 89),
    tileWidth: clampNumber(input.tileWidth, DEFAULT_WATERMARK.tileWidth, 240, 2400),
    tileHeight: clampNumber(input.tileHeight, DEFAULT_WATERMARK.tileHeight, 160, 1600),
  };
  const upsert = db.prepare(
    `INSERT INTO site_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  upsert.run(WATERMARK_KEYS.enabled, settings.enabled ? '1' : '0');
  upsert.run(WATERMARK_KEYS.text, settings.text);
  upsert.run(WATERMARK_KEYS.lightOpacity, String(settings.lightOpacity));
  upsert.run(WATERMARK_KEYS.darkOpacity, String(settings.darkOpacity));
  upsert.run(WATERMARK_KEYS.fontSize, String(settings.fontSize));
  upsert.run(WATERMARK_KEYS.rotate, String(settings.rotate));
  upsert.run(WATERMARK_KEYS.tileWidth, String(settings.tileWidth));
  upsert.run(WATERMARK_KEYS.tileHeight, String(settings.tileHeight));
}

module.exports = { getGuestModules, setGuestModules, getWatermarkSettings, setWatermarkSettings };
