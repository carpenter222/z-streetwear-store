const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'z_store.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);

    seedInitialData();
    console.log('✓ SQLite Database initialized & seeded successfully.');
}

function seedInitialData() {
    // 1. Seed Admin User
    const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!existingAdmin) {
        const hashedPassword = bcrypt.hashSync('zstreetwear2026', 10);
        const insertUser = db.prepare(`
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, 'admin')
        `);
        insertUser.run('admin', 'admin@zclothing.store', hashedPassword);
        console.log('  → Default admin account created (User: admin / Pass: zstreetwear2026)');
    }

    // 2. Seed Categories
    const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    if (categoriesCount === 0) {
        const insertCategory = db.prepare(`
            INSERT INTO categories (slug, name, description, image_url, display_order)
            VALUES (?, ?, ?, ?, ?)
        `);

        insertCategory.run('caps', 'CAPS', 'Streetwear headwear and custom truckers', '/images/z-cap-card.png', 1);
        insertCategory.run('slides', 'SLIDES', 'Ergonomic urban footwear with high-density EVA sole', '/images/z-slides-card.png', 2);
        insertCategory.run('belts', 'BELTS', 'Heavy-duty tactical webbed belts with matte black hardware', '/images/z-belt-card.png', 3);
        insertCategory.run('truckers', 'TRUCKERS', 'Breathable mesh back panel with 3D embroidery', '/images/z-trucker-cap-card.png', 4);
    }

    // 3. Seed Products
    const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (productsCount === 0) {
        const getCatId = slug => db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)?.id || 1;

        const insertProduct = db.prepare(`
            INSERT INTO products (title, slug, description, price, sale_price, badge, category_id, stock, sizes, colors, image_url, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertProduct.run(
            'Z SIGNATURE CAP',
            'z-signature-cap',
            'Low-profile structured 6-panel cap in midnight black. Embroidered red "Z" insignia with gunmetal strap closure.',
            450,
            null,
            'NEW DROP',
            getCatId('caps'),
            24,
            JSON.stringify(['ONE SIZE']),
            JSON.stringify(['#090909', '#ff1735']),
            '/images/z-cap-card.png',
            1
        );

        insertProduct.run(
            'Z SIGNATURE SLIDES',
            'z-signature-slides',
            'Engineered cushioning with high-traction outsole. Raised bold "Z" embossed logo across deep matte black straps.',
            600,
            550,
            'BEST SELLER',
            getCatId('slides'),
            18,
            JSON.stringify(['40', '41', '42', '43', '44', '45']),
            JSON.stringify(['#090909', '#ff1735']),
            '/images/z-slides-card.png',
            1
        );

        insertProduct.run(
            'Z SIGNATURE BELT',
            'z-signature-belt',
            'Military-grade ripstop webbing with heavy-duty quick-release buckle with engraved crimson "Z" typography.',
            750,
            null,
            'NEW DROP',
            getCatId('belts'),
            12,
            JSON.stringify(['ADJUSTABLE (125CM)']),
            JSON.stringify(['#090909', '#2a2a2a']),
            '/images/z-belt-card.png',
            1
        );

        insertProduct.run(
            'Z TRUCKER CAP // RED EMBROIDERY',
            'z-trucker-cap-red-embroidery',
            'Breathable mesh back panel, curved brim, 3D puff crimson Z embroidery. Built for urban everyday hustle.',
            500,
            null,
            'LIMITED',
            getCatId('truckers'),
            15,
            JSON.stringify(['ONE SIZE']),
            JSON.stringify(['#090909', '#990000']),
            '/images/z-trucker-cap-card.png',
            1
        );
    }

    // 4. Seed Promotions
    const promoCount = db.prepare('SELECT COUNT(*) as count FROM promotions').get().count;
    if (promoCount === 0) {
        const insertPromo = db.prepare(`
            INSERT INTO promotions (code, discount_type, discount_value, min_order_amount, is_active, banner_text)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertPromo.run('ZDROP10', 'percentage', 10, 500, 1, 'USE CODE ZDROP10 FOR 10% OFF ORDERS ABOVE 500 EGP');
        insertPromo.run('FIRSTDROP', 'fixed', 100, 800, 1, 'SAVE 100 EGP ON FIRST DROP');
    }

    // 5. Seed Global Settings
    const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
    if (settingCount === 0) {
        const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
        insertSetting.run('announcement', 'THE FIRST DROP IS LIVE · FREE NATIONWIDE SHIPPING ON ORDERS OVER 1,000 EGP · LIMITED STOCK');
        insertSetting.run('store_name', 'Z — Clothing Brand');
        insertSetting.run('currency', 'EGP');
        insertSetting.run('ticker_text', 'OWN YOUR STYLE ✦ WEAR YOUR ATTITUDE ✦ ZERO GRAVITY AESTHETIC ✦ THIS IS Z ✦');
    }
}

module.exports = {
    db,
    initDatabase
};
