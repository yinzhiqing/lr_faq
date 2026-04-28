const http = require('http');
const express = require('express');
const session = require('express-session');
const path = require('path');
const ejsLayouts = require('express-ejs-layouts');
const { exposeUser, requireAdmin } = require('./middleware/auth');
const { exposeGuestAccess, guestAccessGuard } = require('./middleware/guestAccess');
const { attachLiveChat } = require('./lib/liveChat');
const { getWatermarkSettings } = require('./lib/siteSettings');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const sessionMiddleware = session({
  secret: 'faq-kb-secret-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(sessionMiddleware);

attachLiveChat(server, sessionMiddleware);

app.use(exposeUser);
app.use(exposeGuestAccess);
app.use((req, res, next) => {
  res.locals.watermark = getWatermarkSettings();
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(guestAccessGuard);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(ejsLayouts);

// Public routes (view-only)
app.get('/', (req, res) => {
  const db = require('./db/database');
  const products = db.prepare(`
    SELECT p.*, COUNT(f.id) as faq_count
    FROM products p LEFT JOIN faqs f ON f.product_id = p.id
    GROUP BY p.id ORDER BY p.name
  `).all();
  const recentFaqs = db.prepare(`
    SELECT f.*, p.name as product_name, c.name as category_name
    FROM faqs f
    LEFT JOIN products p ON f.product_id = p.id
    LEFT JOIN categories c ON f.category_id = c.id
    ORDER BY f.updated_at DESC LIMIT 8
  `).all();
  const totalFaqs = db.prepare('SELECT COUNT(*) as c FROM faqs').get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  res.render('index', { title: '产品知识库', products, recentFaqs, totalFaqs, totalProducts });
});

app.use('/auth', require('./routes/auth'));

app.use('/settings', require('./routes/settings'));

app.use('/stats', require('./routes/stats'));

app.use('/chat', require('./routes/chat'));

// Admin-only routes
app.use('/products', requireAdmin, require('./routes/products'));
app.use('/categories', requireAdmin, require('./routes/categories'));
app.use('/tags', requireAdmin, require('./routes/tags'));

// Admin-only routes
app.use('/users', require('./routes/users'));

// FAQ routes (view is public, write ops protected inside)
app.use('/faqs', require('./routes/faqs'));

// File routes (download is public, delete is protected inside)
app.use('/files', require('./routes/files'));

server.listen(PORT, () => {
  console.log(`产品知识库已启动: http://localhost:${PORT}`);
});
