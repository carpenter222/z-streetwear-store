const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { initAndSeed } = require('./db/seed');

// Middlewares
const errorHandler = require('./middleware/errorHandler');

// Sectional Routers
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const settingRoutes = require('./routes/settingRoutes');

// Ensure Database is initialized & seeded
initAndSeed();

const app = express();

// Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(config.PUBLIC_DIR));

// Sectioned RESTful API Mounts
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/settings', settingRoutes);

// Backward-compatibility aliases for convenient dashboard usage
app.use('/api/admin/metrics', (req, res, next) => { req.url = '/metrics'; settingRoutes(req, res, next); });
app.use('/api/admin/products', (req, res, next) => productRoutes(req, res, next));
app.use('/api/admin/orders', (req, res, next) => orderRoutes(req, res, next));
app.use('/api/admin/promotions', (req, res, next) => promotionRoutes(req, res, next));
app.use('/api/admin/settings', (req, res, next) => settingRoutes(req, res, next));
app.get('/api/sections', (req, res, next) => { req.url = '/sections'; settingRoutes(req, res, next); });

// ====================================================================
// HTML FRONTEND & ADMIN ROUTES (Windows & Express 5 Native Streaming)
// ====================================================================
app.get('/admin', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    fs.createReadStream(path.join(config.PUBLIC_DIR, 'admin.html')).pipe(res);
});

app.use((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    fs.createReadStream(path.join(config.PUBLIC_DIR, 'index.html')).pipe(res);
});

// Centralized error handler
app.use(errorHandler);

// Start server
const server = app.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(`🔥 "Z" Streetwear Platform Running (Modular Backend)`);
    console.log(`🌐 Storefront: http://localhost:${config.PORT}`);
    console.log(`⚡ Admin Dashboard: http://localhost:${config.PORT}/admin`);
    console.log(`🔑 Admin Credentials: user: ${config.ADMIN_DEFAULT.username} | pass: ${config.ADMIN_DEFAULT.password}`);
    console.log(`=======================================================`);
});

module.exports = app;
