const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');

// 1. Submit Customer Order
router.post('/', (req, res) => {
    try {
        const {
            customer_name, email, phone, address, city,
            items, promo_code, language = 'en'
        } = req.body;

        if (!customer_name || !email || !phone || !address || !city) {
            return res.status(400).json({ success: false, error: 'All shipping details are required.' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Cart is empty.' });
        }

        let subtotal = 0;
        const verifiedItems = [];

        for (const item of items) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
            if (!product) {
                return res.status(400).json({ success: false, error: `Product ID #${item.productId} not found.` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Only ${product.stock} units remaining for "${product.title}".`
                });
            }

            const unitPrice = product.sale_price !== null ? product.sale_price : product.price;
            const lineTotal = unitPrice * item.quantity;
            subtotal += lineTotal;

            verifiedItems.push({
                product,
                unitPrice,
                quantity: item.quantity,
                lineTotal,
                size: item.size || 'Standard',
                color: item.color || '#090909'
            });
        }

        // Promo calculation
        let discountAmount = 0;
        if (promo_code) {
            const promo = db.prepare('SELECT * FROM promotions WHERE UPPER(code) = UPPER(?) AND is_active = 1').get(promo_code.trim());
            if (promo && subtotal >= promo.min_order_amount) {
                discountAmount = promo.discount_type === 'percentage'
                    ? (subtotal * promo.discount_value) / 100
                    : promo.discount_value;
                discountAmount = Math.min(discountAmount, subtotal);
            }
        }

        const totalAmount = subtotal - discountAmount;
        const orderNumber = `Z-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        db.exec('BEGIN TRANSACTION');

        const insertOrder = db.prepare(`
            INSERT INTO orders (
                order_number, customer_name, email, phone, address, city,
                subtotal, discount_amount, total_amount, promo_code, language, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `);

        insertOrder.run(
            orderNumber,
            customer_name.trim(),
            email.trim(),
            phone.trim(),
            address.trim(),
            city.trim(),
            subtotal,
            discountAmount,
            totalAmount,
            promo_code || null,
            language
        );

        const newOrder = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber);

        const insertItem = db.prepare(`
            INSERT INTO order_items (
                order_id, product_id, product_title, selected_size, selected_color,
                unit_price, quantity, total_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

        for (const v of verifiedItems) {
            insertItem.run(
                newOrder.id,
                v.product.id,
                v.product.title,
                v.size,
                v.color,
                v.unitPrice,
                v.quantity,
                v.lineTotal
            );
            updateStock.run(v.quantity, v.product.id);
        }

        db.exec('COMMIT');

        res.status(201).json({
            success: true,
            orderNumber,
            subtotal,
            discountAmount,
            totalAmount
        });
    } catch (err) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Admin: Get Orders List
router.get('/', requireAdmin, (req, res) => {
    try {
        const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
        const items = db.prepare('SELECT * FROM order_items').all();

        const ordersWithItems = orders.map(o => ({
            ...o,
            items: items.filter(it => it.order_id === o.id)
        }));

        res.json({ success: true, count: ordersWithItems.length, orders: ordersWithItems });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Admin: Update Order Status
router.put('/:id/status', requireAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
