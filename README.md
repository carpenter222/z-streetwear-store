# "Z" Streetwear — Full-Stack Web Application & Admin Dashboard

A high-performance, dark-themed Streetwear eCommerce platform with an industrial "Zero Gravity" aesthetic, built using **Node.js**, **Express**, **SQLite (relational SQL with foreign keys & transactions)**, and modern responsive JavaScript/CSS.

---

## 🚀 Key Features

### 1. Storefront (Front-End UI/UX)
- **Signature Aesthetics**: Dark midnight theme (`#070707`), striking crimson accents (`#ff1735`), industrial typography (`Barlow Condensed` for impact headlines and `Inter` for clean readability).
- **Anti-Gravity Physics**: Floating geometric archive badges, ambient hover tilt on product cards (`rotateX` / `rotateY` 3D perspective), and levitating elements.
- **Dynamic Catalog**: Live category filtering, instant debounce search, color & size selectors.
- **Slide-Out Bag & Checkout**: Slide-out cart drawer with live subtotal calculation, coupon/promo code engine, and a complete order checkout modal.

### 2. Relational Database & Backend API
- **SQLite Engine**: Zero-configuration, lightning-fast native relational database.
- **Referential Integrity**: Cascading deletes, check constraints, foreign keys for Users, Categories, Products, Promotions, Orders, and Order Items.
- **Security**: JWT (JSON Web Tokens) with `bcryptjs` salted password hashing for administrative access.
- **Transactions**: Atomic transactions (`BEGIN` ... `COMMIT` / `ROLLBACK`) for order submissions and stock inventory decrement.

### 3. Professional Admin Dashboard (`/admin`)
- **Key Metrics (KPIs)**: Live tracking of Total Sales Revenue, Total Orders, Pending Logistics, and Low Stock inventory alerts.
- **Product Management (CRUD)**: Add, edit, or delete clothing items, configure image URLs, custom badges (`NEW DROP`, `BEST SELLER`, `LIMITED`), stock count, and size runs.
- **Order Logistics**: View customer contact and delivery details, breakdown of purchased items, and instant live status transitions (`Pending` ➔ `Processing` ➔ `Shipped` ➔ `Delivered` ➔ `Cancelled`).
- **Promotions & Headlines**: Live real-time updater for the top announcement banner text and streaming marquee ticker, plus coupon code creation with percentage or fixed discounts.

---

## 📁 Project Architecture

```
z-streetwear-store/
├── package.json            # Node.js project manifest & dependencies
├── server.js               # Express API server with JWT Auth & endpoints
├── db.js                   # SQLite connection, seeding & relational models
├── schema.sql              # Relational SQL DDL commands (DDL & constraints)
├── public/                 # Static web assets
│   ├── index.html          # Refactored Storefront (Zero-Gravity Streetwear)
│   ├── admin.html          # Professional Admin Command Center
│   ├── css/
│   │   ├── style.css       # Storefront styles (Barlow Condensed, Glow, Floating)
│   │   └── admin.css       # Admin dashboard styles (Dark cyberpunk UI)
│   └── js/
│       ├── store.js        # Storefront client logic (Cart, API, 3D tilt)
│       └── admin.js        # Admin client logic (JWT Auth, CRUD, Statuses)
└── README.md
```

---

## 🛠️ Step-by-Step Instructions to Run Locally

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher; v22+ / v24 recommended) installed on your machine.

### 2. Navigate to the project directory
```bash
cd "C:\Users\ASUS ROG\.gemini\antigravity\scratch\z-streetwear-store"
```

### 3. Install dependencies (if setting up on a fresh machine)
```bash
npm install
```

### 4. Start the server
```bash
node server.js
```

### 5. Access the applications
- **Customer Storefront**: [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔑 Default Admin Credentials

| Field | Default Value |
|---|---|
| **Username** | `admin` |
| **Password** | `zstreetwear2026` |

---

## ⚡ REST API Endpoints Overview

### Public Endpoints
- `GET /api/settings` — Get live announcement banner & ticker texts
- `GET /api/categories` — Get active categories
- `GET /api/products` — Search and filter products (`?category=caps&search=hoodie`)
- `GET /api/products/:id` — Get product details
- `POST /api/promotions/validate` — Validate promo code against current cart
- `POST /api/orders` — Create customer order with atomic stock validation
- `POST /api/auth/login` — Authenticate admin and receive JWT token

### Admin Protected Endpoints (`Authorization: Bearer <token>`)
- `GET /api/admin/metrics` — Dashboard KPI stats
- `GET /api/admin/products` — Retrieve all catalog items
- `POST /api/admin/products` — Create new piece
- `PUT /api/admin/products/:id` — Update piece details
- `DELETE /api/admin/products/:id` — Remove piece from store
- `GET /api/admin/orders` — View customer orders with item details
- `PUT /api/admin/orders/:id/status` — Update order fulfillment state
- `GET /api/admin/promotions` — View coupons
- `POST /api/admin/promotions` — Create new promo coupon
- `PUT /api/admin/promotions/:id` — Toggle coupon active status
- `DELETE /api/admin/promotions/:id` — Delete coupon
- `PUT /api/admin/settings` — Update top banner text & ticker live
