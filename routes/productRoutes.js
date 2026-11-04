const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

// 1. Get products (Public catalog with sections, category filters, and search)
router.get('/', (req, res) => {
    try {
        const { category, section, search, activeOnly = '1' } = req.query;

        let query = `
            SELECT p.*,
                   c.name_en as category_name_en, c.name_ar as category_name_ar, c.slug as category_slug,
                   s.name_en as section_name_en, s.name_ar as section_name_ar
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sections s ON p.section_key = s.key
            WHERE 1=1
        `;
        const params = [];

        if (activeOnly === '1' || activeOnly === 'true') {
            query += ' AND p.is_active = 1';
        }

        if (section && section !== 'all') {
            query += ' AND p.section_key = ?';
            params.push(section);
        }

        if (category && category !== 'all') {
            query += ' AND (c.slug = ? OR c.name_en = ? OR c.name_ar = ?)';
            params.push(category, category, category);
        }

        if (search) {
            query += ' AND (p.title LIKE ? OR p.title_ar LIKE ? OR p.description LIKE ? OR p.description_ar LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ' ORDER BY p.display_order ASC, p.id DESC';

        const products = db.prepare(query).all(...params).map(p => ({
            ...p,
            sizes: JSON.parse(p.sizes || '[]'),
            colors: JSON.parse(p.colors || '[]')
        }));

        res.json({ success: true, count: products.length, products });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Get single product detail
router.get('/:id', (req, res) => {
    try {
        const product = db.prepare(`
            SELECT p.*,
                   c.name_en as category_name_en, c.name_ar as category_name_ar, c.slug as category_slug,
                   s.name_en as section_name_en, s.name_ar as section_name_ar
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sections s ON p.section_key = s.key
            WHERE p.id = ? OR p.slug = ?
        `).get(req.params.id, req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        product.sizes = JSON.parse(product.sizes || '[]');
        product.colors = JSON.parse(product.colors || '[]');

        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Admin: Create Product
router.post('/', requireAdmin, (req, res) => {
    try {
        const {
            title, title_ar, description, description_ar, price, sale_price,
            badge, badge_ar, category_id, section_key = 'featured',
            display_order = 0, stock = 15, sizes, colors, image_url, is_featured = 1, is_active = 1
        } = req.body;

        if (!title || price === undefined) {
            return res.status(400).json({ success: false, error: 'Product title and price are required.' });
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

        const insert = db.prepare(`
            INSERT INTO products (
                title, title_ar, slug, description, description_ar, price, sale_price,
                badge, badge_ar, category_id, section_key, display_order, stock,
                sizes, colors, image_url, is_featured, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insert.run(
            title.trim(),
            title_ar ? title_ar.trim() : title.trim(),
            slug,
            description || '',
            description_ar || '',
            Number(price),
            sale_price ? Number(sale_price) : null,
            badge || 'NEW DROP',
            badge_ar || 'إصدار جديد',
            category_id ? Number(category_id) : null,
            section_key || 'featured',
            Number(display_order) || 0,
            Number(stock) || 0,
            typeof sizes === 'string' ? sizes : JSON.stringify(sizes || ['ONE SIZE']),
            typeof colors === 'string' ? colors : JSON.stringify(colors || ['#090909']),
            image_url || '/images/z-tee.jpg',
            Number(is_featured) || 1,
            Number(is_active) || 1
        );

        res.status(201).json({ success: true, message: 'Product created successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Admin: Update Product (Price, Section, Order, Info)
router.put('/:id', requireAdmin, (req, res) => {
    try {
        const {
            title, title_ar, description, description_ar, price, sale_price,
            badge, badge_ar, category_id, section_key, display_order, stock,
            sizes, colors, image_url, is_featured, is_active
        } = req.body;

        const update = db.prepare(`
            UPDATE products SET
                title = COALESCE(?, title),
                title_ar = COALESCE(?, title_ar),
                description = COALESCE(?, description),
                description_ar = COALESCE(?, description_ar),
                price = COALESCE(?, price),
                sale_price = ?,
                badge = COALESCE(?, badge),
                badge_ar = COALESCE(?, badge_ar),
                category_id = COALESCE(?, category_id),
                section_key = COALESCE(?, section_key),
                display_order = COALESCE(?, display_order),
                stock = COALESCE(?, stock),
                sizes = COALESCE(?, sizes),
                colors = COALESCE(?, colors),
                image_url = COALESCE(?, image_url),
                is_featured = COALESCE(?, is_featured),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        update.run(
            title ? title.trim() : null,
            title_ar ? title_ar.trim() : null,
            description,
            description_ar,
            price !== undefined ? Number(price) : null,
            sale_price !== undefined ? (sale_price ? Number(sale_price) : null) : null,
            badge,
            badge_ar,
            category_id !== undefined ? Number(category_id) : null,
            section_key,
            display_order !== undefined ? Number(display_order) : null,
            stock !== undefined ? Number(stock) : null,
            typeof sizes === 'object' ? JSON.stringify(sizes) : sizes,
            typeof colors === 'object' ? JSON.stringify(colors) : colors,
            image_url,
            is_featured !== undefined ? Number(is_featured) : null,
            is_active !== undefined ? Number(is_active) : null,
            req.params.id
        );

        res.json({ success: true, message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Admin: Quick Section & Position Reorder (Move item to any section & position)
router.put('/:id/reorder', requireAdmin, (req, res) => {
    try {
        const { section_key, display_order } = req.body;
        if (!section_key && display_order === undefined) {
            return res.status(400).json({ success: false, error: 'section_key or display_order required.' });
        }

        db.prepare(`
            UPDATE products SET
                section_key = COALESCE(?, section_key),
                display_order = COALESCE(?, display_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(section_key, display_order !== undefined ? Number(display_order) : null, req.params.id);

        res.json({ success: true, message: 'Product section and order updated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Admin: Delete Product
router.delete('/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
