const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

// 1. Public: Validate promo code
router.post('/validate', (req, res) => {
    try {
        const { code, cartSubtotal = 0 } = req.body;
        if (!code) {
            return res.status(400).json({ valid: false, error: 'Promo code required' });
        }

        const promo = db.prepare(`
            SELECT * FROM promotions
            WHERE UPPER(code) = UPPER(?) AND is_active = 1
        `).get(code.trim());

        if (!promo) {
            return res.status(404).json({ valid: false, error: 'Invalid or expired code' });
        }

        const subtotal = Number(cartSubtotal);
        if (subtotal < promo.min_order_amount) {
            return res.status(400).json({
                valid: false,
                error: `Requires minimum order of EGP ${promo.min_order_amount}`
            });
        }

        let discount = 0;
        if (promo.discount_type === 'percentage') {
            discount = (subtotal * promo.discount_value) / 100;
        } else {
            discount = promo.discount_value;
        }
        discount = Math.min(discount, subtotal);

        res.json({
            valid: true,
            code: promo.code,
            discount_type: promo.discount_type,
            discount_value: promo.discount_value,
            calculated_discount: discount
        });
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

// 2. Admin: List promotions
router.get('/', requireAdmin, (req, res) => {
    try {
        const promotions = db.prepare('SELECT * FROM promotions ORDER BY id DESC').all();
        res.json({ success: true, count: promotions.length, promotions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Admin: Create promotion
router.post('/', requireAdmin, (req, res) => {
    try {
        const { code, discount_type, discount_value, min_order_amount = 0, is_active = 1, banner_text_en, banner_text_ar } = req.body;
        if (!code || !discount_type || discount_value === undefined) {
            return res.status(400).json({ success: false, error: 'Code, type, and value are required.' });
        }

        db.prepare(`
            INSERT INTO promotions (code, discount_type, discount_value, min_order_amount, is_active, banner_text_en, banner_text_ar)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(code.trim().toUpperCase(), discount_type, Number(discount_value), Number(min_order_amount), Number(is_active), banner_text_en || '', banner_text_ar || '');

        res.status(201).json({ success: true, message: 'Promotion created' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Admin: Toggle promotion active status
router.put('/:id', requireAdmin, (req, res) => {
    try {
        const { is_active } = req.body;
        db.prepare('UPDATE promotions SET is_active = ? WHERE id = ?').run(Number(is_active), req.params.id);
        res.json({ success: true, message: 'Promotion updated' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Admin: Delete promotion
router.delete('/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM promotions WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Promotion deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
