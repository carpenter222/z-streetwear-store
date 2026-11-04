const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');

router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '48h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/verify', requireAdmin, (req, res) => {
    res.json({ success: true, user: req.user });
});

module.exports = router;
