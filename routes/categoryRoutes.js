const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

router.get('/', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC, id ASC').all();
        res.json({ success: true, count: categories.length, categories });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ar, slug, description_en, description_ar, image_url, display_order = 0 } = req.body;
        if (!name_en) {
            return res.status(400).json({ success: false, error: 'Category name is required' });
        }
        const cleanSlug = slug || name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        db.prepare(`
            INSERT INTO categories (name_en, name_ar, slug, description_en, description_ar, image_url, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(name_en.trim(), name_ar || name_en, cleanSlug, description_en || '', description_ar || '', image_url || '', Number(display_order));

        res.status(201).json({ success: true, message: 'Category created' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
