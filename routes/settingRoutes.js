const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

// 1. Get store settings
router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Get store sections (Featured Drop, New Arrivals, Core Essentials, etc.)
router.get('/sections', (req, res) => {
    try {
        const sections = db.prepare('SELECT * FROM sections WHERE is_active = 1 ORDER BY display_order ASC').all();
        res.json({ success: true, sections });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Admin: Update store settings
router.put('/', requireAdmin, (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, error: 'Settings object is required' });
        }

        const updateSetting = db.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `);

        for (const [key, value] of Object.entries(settings)) {
            updateSetting.run(key, String(value));
        }

        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Admin: Get Dashboard Metrics (KPI)
router.get('/metrics', requireAdmin, (req, res) => {
    try {
        const totalSales = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'Cancelled'").get().total;
        const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
        const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'").get().count;
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 5').get().count;

        const recentOrders = db.prepare(`
            SELECT id, order_number, customer_name, total_amount, status, language, created_at
            FROM orders
            ORDER BY id DESC
            LIMIT 6
        `).all();

        res.json({
            success: true,
            metrics: {
                totalSales,
                totalOrders,
                pendingOrders,
                totalProducts,
                lowStockCount
            },
            recentOrders
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
