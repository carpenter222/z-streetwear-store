-- ====================================================================
-- Database Schema for "Z" Streetwear Clothing Brand
-- Modular Architecture with Sections, Bilingual Fields & Accessibility
-- ====================================================================

-- 1. Administrators & Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'staff', 'customer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Store Sections (Dynamic sections on homepage: Featured Drop, New Arrivals, etc.)
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    subtitle_en VARCHAR(200),
    subtitle_ar VARCHAR(200),
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- 3. Categories (Tees, Jackets, Cargo Pants, Caps, Footwear, Belts)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products (With Section, Order, Bilingual Title & Description)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(150) NOT NULL,
    title_ar VARCHAR(150),
    slug VARCHAR(160) UNIQUE NOT NULL,
    description TEXT,
    description_ar TEXT,
    price DECIMAL(10, 2) NOT NULL,
    sale_price DECIMAL(10, 2) DEFAULT NULL,
    badge VARCHAR(50) DEFAULT 'NEW DROP',
    badge_ar VARCHAR(50) DEFAULT 'إصدار جديد',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    section_key VARCHAR(50) DEFAULT 'featured' REFERENCES sections(key) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 15,
    sizes TEXT DEFAULT '["S", "M", "L", "XL"]',
    colors TEXT DEFAULT '["#090909", "#ff1735"]',
    image_url TEXT NOT NULL,
    is_featured INTEGER DEFAULT 1 CHECK (is_featured IN (0, 1)),
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Promotions & Discount Codes
CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    banner_text_en TEXT,
    banner_text_ar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customer Orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number VARCHAR(30) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    promo_code VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Order Line Items
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_title VARCHAR(150) NOT NULL,
    selected_size VARCHAR(20),
    selected_color VARCHAR(30),
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price DECIMAL(10, 2) NOT NULL
);

-- 8. Store Settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & quick section querying
CREATE INDEX IF NOT EXISTS idx_products_section ON products(section_key, display_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
