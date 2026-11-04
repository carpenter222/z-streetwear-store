const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./connection');
const config = require('../config');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function initAndSeed() {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);

    // 1. Seed Admin
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get(config.ADMIN_DEFAULT.username);
    if (!admin) {
        const hashedPassword = bcrypt.hashSync(config.ADMIN_DEFAULT.password, 10);
        db.prepare(`
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, 'admin')
        `).run(config.ADMIN_DEFAULT.username, config.ADMIN_DEFAULT.email, hashedPassword);
        console.log('✓ Admin user initialized:', config.ADMIN_DEFAULT.username);
    }

    // 2. Seed Sections
    const sectionCount = db.prepare('SELECT COUNT(*) as count FROM sections').get().count;
    if (sectionCount === 0) {
        const insertSection = db.prepare(`
            INSERT INTO sections (key, name_en, name_ar, subtitle_en, subtitle_ar, display_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertSection.run('featured', 'FEATURED DROP', 'الإصدار المميز', 'HEAVYWEIGHT FABRIC · SIGNATURE CUT', 'خامات ثقيلة فاخرة · قصّة مميزة', 1);
        insertSection.run('new_arrivals', 'NEW ARRIVALS 2026', 'وصل حديثاً 2026', 'FRESH OFF THE PRODUCTION LINE', 'أحدث القطع مباشرة من خط الإنتاج', 2);
        insertSection.run('essentials', 'CORE ACCESSORIES', 'إكسسوارات أساسية', 'EVERYDAY SIGNATURE HARDWARE', 'تفاصيل وإكسسوارات يومية متقنة', 3);
        console.log('✓ Store sections initialized.');
    }

    // 3. Seed Categories
    const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    if (catCount === 0) {
        const insertCat = db.prepare(`
            INSERT INTO categories (slug, name_en, name_ar, description_en, description_ar, image_url, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertCat.run('tees', 'TEES', 'تيشيرتات', '500 GSM loopback cotton heavyweight oversized t-shirts', 'تيشيرتات قطنية ثقيلة بوزن 500 جرام وتصميم أوفر سايز', '/images/z-tee.jpg', 1);
        insertCat.run('jackets', 'JACKETS', 'جواكت', 'Water-resistant tactical zip bomber jackets with high collar', 'جواكت بومبر تكتيكية مقاومة للماء بياقة مرتفعة', '/images/z-jacket.jpg', 2);
        insertCat.run('pants', 'PANTS', 'بناطيل', 'Heavyweight relaxed-fit streetwear everyday trousers', 'بناطيل قطنية متينة بتصميم ريلاكسد مريح للاستخدام اليومي', '/images/z-cargo.jpg', 3);
        insertCat.run('caps', 'CAPS', 'كابات', 'Structured 6-panel and breathable trucker caps', 'كابات منظمة وتراكر بشبكة مسامية', '/images/z-cap-card.png', 4);
        insertCat.run('footwear', 'FOOTWEAR', 'سلايدز', 'High density EVA urban slide sandals', 'سلايدز وصنادل مريحة بنعل فوم متين', '/images/z-slides-card.png', 5);
        insertCat.run('accessories', 'BELTS', 'أحزمة', 'Quick-release tactical webbed belts', 'أحزمة تكتيكية سريعة الفك وعالية التحمل', '/images/z-belt-card.png', 6);
        console.log('✓ Categories initialized.');
    }

    // 4. Seed Products
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (prodCount === 0) {
        const getCatId = slug => db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)?.id || 1;
        const insertProduct = db.prepare(`
            INSERT INTO products (
                title, title_ar, slug, description, description_ar,
                price, sale_price, badge, badge_ar, category_id,
                section_key, display_order, stock, sizes, colors, image_url, is_featured, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        // 1. Z Signature Oversized Tee (From uploaded 4K photo)
        insertProduct.run(
            'Z SIGNATURE OVERSIZED TEE',
            'تيشيرت Z أوفر سايز هيفي ويت',
            'z-signature-oversized-tee',
            'Crafted from 320 GSM luxury combed cotton. Dropped shoulder streetwear cut with precision crimson embroidered Z lightning emblem on the left chest.',
            'مصنوع من قطن فاخر ممشط بوزن 320 جرام. قصة أوفر سايز بأكتاف ساقطة مع تطريز دقيق لشعار Z القرمزي على الصدر.',
            850,
            null,
            'NEW DROP',
            'إصدار جديد',
            getCatId('tees'),
            'featured',
            1,
            30,
            JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
            JSON.stringify(['#090909', '#1a1a1a']),
            '/images/z-tee.jpg',
            1
        );

        // 2. Z Tactical Bomber Zip Jacket (From uploaded 4K photo)
        insertProduct.run(
            'Z TACTICAL BOMBER JACKET',
            'جاكيت Z بومبر تكتيكي سحاب',
            'z-tactical-bomber-jacket',
            'Engineered matte-black shell jacket with heavy-gauge industrial zipper, thermal ribbed storm cuffs, and embroidered crimson Z chest signature.',
            'جاكيت تكتيكي أسود مطفي مع سحاب معدني صناعي قوي، وياقة مرتفعة، وأساور مضلعة عازلة مع تطريز أحمر بارز.',
            1850,
            1650,
            'BEST SELLER',
            'الأكثر طلباً',
            getCatId('jackets'),
            'featured',
            2,
            18,
            JSON.stringify(['M', 'L', 'XL', 'XXL']),
            JSON.stringify(['#090909']),
            '/images/z-jacket.jpg',
            1
        );

        // 3. Z Relaxed Fit Pants (From uploaded 4K photo)
        insertProduct.run(
            'Z RELAXED FIT PANTS',
            'بنطلون Z ريلاكسد كلاسيك',
            'z-relaxed-fit-pants',
            'Heavy-duty relaxed streetwear trousers with comfortable straight-leg silhouette, deep pockets, and signature crimson Z embroidery.',
            'بنطلون قطني متين بقصة ستريت وير مستقيمة ومريحة مع جيوب عملية وتطريز أحمر مميز لشعار Z.',
            1250,
            null,
            'LIMITED',
            'كمية محدودة',
            getCatId('pants'),
            'featured',
            3,
            22,
            JSON.stringify(['30', '32', '34', '36', '38']),
            JSON.stringify(['#090909']),
            '/images/z-cargo.jpg',
            1
        );

        // 4. Z Signature Cap
        insertProduct.run(
            'Z SIGNATURE BASEBALL CAP',
            'كاب Z بيسبول كلاسيكي',
            'z-signature-baseball-cap',
            'Low-profile structured 6-panel cap in midnight black. 3D crimson Z emblem with matte gunmetal sizing buckle.',
            'كاب بيسبول أسود منتظم بـ 6 ألواح، مطرز بشعار Z قرمزي بارز وإبزيم معدني داكن للتحكم بالمقاس.',
            450,
            null,
            'NEW DROP',
            'إصدار جديد',
            getCatId('caps'),
            'new_arrivals',
            1,
            25,
            JSON.stringify(['ONE SIZE']),
            JSON.stringify(['#090909']),
            '/images/z-cap-card.png',
            0
        );

        // 5. Z Signature Slides
        insertProduct.run(
            'Z ERGONOMIC FOAM SLIDES',
            'سلايدز Z فوم مريح',
            'z-ergonomic-foam-slides',
            'Molded high-density EVA footbed offering cloud-like arch support. Bold embossed crimson Z typography on textured strap.',
            'سلايدز مريح بنعل فوم إيفا عالي الكثافة مع دعم لقوس القدم وتصميم بارز لشعار Z على السير العريض.',
            600,
            550,
            'SALE',
            'تخفيض',
            getCatId('footwear'),
            'new_arrivals',
            2,
            20,
            JSON.stringify(['40', '41', '42', '43', '44', '45']),
            JSON.stringify(['#090909', '#ff1735']),
            '/images/z-slides-card.png',
            0
        );

        // 6. Z Tactical Belt
        insertProduct.run(
            'Z INDUSTRIAL WEBBED BELT',
            'حزام Z تكتيكي كويك ريليس',
            'z-industrial-webbed-belt',
            'Ballistic military nylon webbing belt with quick-release zinc alloy buckle featuring laser-etched crimson Z branding.',
            'حزام نايلون عسكري متين ومقاوم للتمزق مع إبزيم معدني سريع الفك محفور عليه شعار Z بالليزر.',
            750,
            null,
            'RESTOCKED',
            'تم التجديد',
            getCatId('accessories'),
            'essentials',
            1,
            15,
            JSON.stringify(['ADJUSTABLE (125CM)']),
            JSON.stringify(['#090909']),
            '/images/z-belt-card.png',
            0
        );

        // 7. Z Trucker Cap
        insertProduct.run(
            'Z AIR-MESH TRUCKER CAP',
            'كاب Z تراكر شبك مسامي',
            'z-air-mesh-trucker-cap',
            'Breathable rear mesh panels, pre-curved brim, and high-density puff embroidered crimson Z on front crown.',
            'كاب تراكر بشبكة تهوية خلفية، ونقاب مقوس مع تطريز بارز لشعار Z القرمزي على الواجهة.',
            500,
            null,
            'HOT DROP',
            'الأكثر رواجاً',
            getCatId('caps'),
            'essentials',
            2,
            16,
            JSON.stringify(['ONE SIZE']),
            JSON.stringify(['#090909']),
            '/images/z-trucker-cap-card.png',
            0
        );
        console.log('✓ Products seeded successfully with 4K assets and bilingual content.');
    }

    // 5. Seed Global Settings
    const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
    if (settingCount === 0) {
        const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
        insertSetting.run('announcement_en', 'THE FIRST DROP IS LIVE · FREE NATIONWIDE SHIPPING OVER 1,000 EGP · LIMITED STOCK');
        insertSetting.run('announcement_ar', 'الإصدار الأول متاح الآن · شحن مجاني لكافة المحافظات للطلبات فوق 1,000 جنيه · كميات محدودة');
        insertSetting.run('ticker_en', 'OWN YOUR STYLE ✦ WEAR YOUR ATTITUDE ✦ ZERO GRAVITY AESTHETIC ✦ THIS IS Z ✦');
        insertSetting.run('ticker_ar', 'اصنع أسلوبك الخاص ✦ ارتدِ موقفك ✦ جماليات انعدام الجاذبية ✦ هذا هو Z ✦');
        insertSetting.run('hero_banner', '/images/hero-cinematic.png');
        insertSetting.run('store_name', 'Z — Clothing Brand');
        insertSetting.run('currency', 'EGP');
        console.log('✓ Store settings initialized.');
    }

    // 6. Seed Default Promotions
    const promoCount = db.prepare('SELECT COUNT(*) as count FROM promotions').get().count;
    if (promoCount === 0) {
        const insertPromo = db.prepare(`
            INSERT INTO promotions (code, discount_type, discount_value, min_order_amount, is_active, banner_text_en, banner_text_ar)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertPromo.run('ZDROP10', 'percentage', 10, 500, 1, 'USE CODE ZDROP10 FOR 10% OFF', 'استخدم كود ZDROP10 لخصم 10%');
        insertPromo.run('FIRSTDROP', 'fixed', 100, 800, 1, '100 EGP OFF YOUR FIRST ORDER', 'خصم 100 جنيه على طلبك الأول');
    }
}

module.exports = {
    initAndSeed
};
