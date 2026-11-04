// ====================================================================
// "Z" STREETWEAR - STORE ENGINE (BILINGUAL, DUAL THEME, SECTIONS)
// ====================================================================

const state = {
    lang: localStorage.getItem('z_lang') || 'en',
    theme: localStorage.getItem('z_theme') || 'dark',
    products: [],
    sections: [],
    categories: [],
    settings: {},
    activeCategory: 'all',
    searchQuery: '',
    cart: JSON.parse(localStorage.getItem('z_cart') || '[]'),
    appliedPromo: null
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Format currency
const formatMoney = (amount) => {
    const isAr = state.lang === 'ar';
    const num = Number(amount || 0).toLocaleString(isAr ? 'ar-EG' : 'en-EG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    return isAr ? `${num} ج.م` : `EGP ${num}`;
};

// ====================================================================
// INITIALIZATION
// ====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initLanguage();
    setupEventListeners();
    await loadStoreData();
    renderCart();
});

// ====================================================================
// THEME & LANGUAGE CONTROLLER
// ====================================================================
function initTheme() {
    document.documentElement.dataset.theme = state.theme;
    updateThemeButtonUI();
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('z_theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    updateThemeButtonUI();
}

function updateThemeButtonUI() {
    const btn = $('#theme-toggle-btn');
    if (!btn) return;
    const isDark = state.theme === 'dark';
    const t = window.I18N ? window.I18N[state.lang] : {};
    btn.innerHTML = isDark
        ? `<span>☀️</span> <span>${t.theme_light || 'LIGHT'}</span>`
        : `<span>🌙</span> <span>${t.theme_dark || 'DARK'}</span>`;
}

function initLanguage() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    applyTranslations();
}

function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'ar' : 'en';
    localStorage.setItem('z_lang', state.lang);
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    applyTranslations();
    renderCategories();
    renderSectionsAndProducts();
    renderCart();
    updateThemeButtonUI();
}

function applyTranslations() {
    const t = window.I18N ? window.I18N[state.lang] : {};
    if (!t) return;

    // Static text elements
    $$('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) el.textContent = t[key];
    });

    // Placeholders
    $$('[data-i18n-ph]').forEach(el => {
        const key = el.dataset.i18nPh;
        if (t[key]) el.placeholder = t[key];
    });

    // Language toggle button text
    const langBtn = $('#lang-toggle-btn');
    if (langBtn) {
        langBtn.textContent = state.lang === 'en' ? '🌐 عربي' : '🌐 EN';
    }

    // Dynamic settings strings
    const annKey = state.lang === 'ar' ? 'announcement_ar' : 'announcement_en';
    const tickerKey = state.lang === 'ar' ? 'ticker_ar' : 'ticker_en';

    if (state.settings[annKey]) {
        $('#announcement-text').textContent = state.settings[annKey];
    }
    if (state.settings[tickerKey]) {
        $('#ticker-text').textContent = `${state.settings[tickerKey]} ✦ ${state.settings[tickerKey]}`;
    }
}

// ====================================================================
// DATA FETCHING
// ====================================================================
// All store data lives in two files the owner edits on GitHub:
// data/store.json (settings, categories, sections, promo codes) and data/products.json.
state.allProducts = [];
state.promoCodes = [];

// Accept "images/x.jpg" or "/images/x.jpg" so paths work under a GitHub Pages sub-folder.
const assetPath = (p) => String(p || 'images/z-tee.jpg').replace(/^\/+/, '');

async function loadJSON(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load ${path}`);
    return res.json();
}

async function loadStoreData() {
    try {
        const [store, products] = await Promise.all([
            loadJSON('data/store.json'),
            loadJSON('data/products.json')
        ]);

        state.settings = store;
        state.sections = store.sections || [];
        state.promoCodes = store.promo_codes || [];
        state.categories = (store.categories || []).map(c => ({ ...c, image_url: assetPath(c.image) }));

        const catBySlug = Object.fromEntries(state.categories.map(c => [c.slug, c]));
        state.allProducts = products
            .filter(p => p.visible !== false)
            .map((p, i) => {
                const cat = catBySlug[p.category] || {};
                return {
                    id: Number(p.id ?? i + 1),
                    title: p.name_en || '',
                    title_ar: p.name_ar || '',
                    description: p.description_en || '',
                    description_ar: p.description_ar || '',
                    price: Number(p.price) || 0,
                    sale_price: p.sale_price === null || p.sale_price === undefined || p.sale_price === '' ? null : Number(p.sale_price),
                    badge: p.badge_en || '',
                    badge_ar: p.badge_ar || '',
                    category_slug: p.category,
                    category_name_en: cat.name_en,
                    category_name_ar: cat.name_ar,
                    section_key: p.section || 'featured',
                    sizes: Array.isArray(p.sizes) ? p.sizes : [],
                    image_url: assetPath(p.image)
                };
            });

        applyTranslations();
        renderCategories();
        renderFilterTabs();
        fetchProducts();
    } catch (err) {
        console.error('Error loading store data:', err);
    }
}

// Filters the loaded products by the active category and search text.
function fetchProducts() {
    const q = state.searchQuery.toLowerCase();
    state.products = state.allProducts.filter(p => {
        if (state.activeCategory !== 'all' && p.category_slug !== state.activeCategory) return false;
        if (!q) return true;
        return [p.title, p.title_ar, p.description, p.description_ar].some(v => v.toLowerCase().includes(q));
    });
    renderSectionsAndProducts();
}

// ====================================================================
// RENDERING SECTIONS & PRODUCTS
// ====================================================================
function renderCategories() {
    const container = $('#collections-container');
    if (!container) return;

    container.innerHTML = state.categories.map(cat => {
        const name = state.lang === 'ar' ? (cat.name_ar || cat.name_en) : cat.name_en;
        return `
            <div class="collection-card" data-category="${cat.slug}" role="button" tabindex="0" aria-label="${name}">
                <div class="collection-img" style="background-image: url('${cat.image_url || 'images/z-tee.jpg'}');"></div>
                <div class="collection-info">
                    <span>${name}</span>
                    <span class="collection-arrow">↗</span>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.collection-card').forEach(card => {
        const handleSelect = () => {
            setActiveCategory(card.dataset.category);
            const shopSection = $('#shop');
            if (shopSection) shopSection.scrollIntoView({ behavior: 'smooth' });
        };
        card.addEventListener('click', handleSelect);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(); });
    });
}

function renderFilterTabs() {
    const tabs = $('#filter-tabs');
    if (!tabs) return;

    const t = window.I18N ? window.I18N[state.lang] : {};
    let html = `<button class="filter-btn ${state.activeCategory === 'all' ? 'active' : ''}" data-category="all">${t.filter_all || 'ALL'}</button>`;

    state.categories.forEach(cat => {
        const name = state.lang === 'ar' ? (cat.name_ar || cat.name_en) : cat.name_en;
        html += `<button class="filter-btn ${state.activeCategory === cat.slug ? 'active' : ''}" data-category="${cat.slug}">${name}</button>`;
    });

    tabs.innerHTML = html;

    tabs.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveCategory(btn.dataset.category);
        });
    });
}

function setActiveCategory(catSlug) {
    state.activeCategory = catSlug;
    renderFilterTabs();
    fetchProducts();
}

function renderSectionsAndProducts() {
    const container = $('#sections-product-container');
    const emptyMsg = $('#no-products');
    if (!container) return;

    if (state.products.length === 0) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    // If searching or category filtering is active, show matching results directly
    if (state.activeCategory !== 'all' || state.searchQuery) {
        container.innerHTML = `
            <div class="store-section-block">
                <div class="products-grid">
                    ${state.products.map(p => createProductCardHTML(p)).join('')}
                </div>
            </div>
        `;
        initProductEvents();
        return;
    }

    // Default View: Group products by dynamic sections
    const defaultSections = state.sections.length ? state.sections : [
        { key: 'featured', name_en: 'FEATURED DROP', name_ar: 'الإصدار المميز', subtitle_en: 'HEAVYWEIGHT FABRIC · SIGNATURE CUT', subtitle_ar: 'خامات ثقيلة فاخرة · قصّة مميزة' },
        { key: 'new_arrivals', name_en: 'NEW ARRIVALS 2026', name_ar: 'وصل حديثاً 2026', subtitle_en: 'FRESH OFF THE PRODUCTION LINE', subtitle_ar: 'أحدث القطع مباشرة من خط الإنتاج' },
        { key: 'essentials', name_en: 'CORE ACCESSORIES', name_ar: 'إكسسوارات أساسية', subtitle_en: 'EVERYDAY SIGNATURE HARDWARE', subtitle_ar: 'تفاصيل وإكسسوارات يومية متقنة' }
    ];

    let html = '';
    defaultSections.forEach(sec => {
        const sectionProducts = state.products.filter(p => (p.section_key || 'featured') === sec.key);
        if (sectionProducts.length > 0) {
            const secTitle = state.lang === 'ar' ? sec.name_ar : sec.name_en;
            const secSubtitle = state.lang === 'ar' ? sec.subtitle_ar : sec.subtitle_en;

            html += `
                <div class="store-section-block" id="section-${sec.key}">
                    <div class="section-headline-area">
                        <div>
                            <span class="section-subtitle">${secSubtitle || ''}</span>
                            <h3>${secTitle}<span>.</span></h3>
                        </div>
                    </div>
                    <div class="products-grid">
                        ${sectionProducts.map(p => createProductCardHTML(p)).join('')}
                    </div>
                </div>
            `;
        }
    });

    // Any products without a matching section
    const assignedKeys = defaultSections.map(s => s.key);
    const unassigned = state.products.filter(p => !assignedKeys.includes(p.section_key));
    if (unassigned.length > 0) {
        html += `
            <div class="store-section-block">
                <div class="section-headline-area">
                    <h3>${state.lang === 'ar' ? 'قطع إضافية' : 'MORE PIECES'}<span>.</span></h3>
                </div>
                <div class="products-grid">
                    ${unassigned.map(p => createProductCardHTML(p)).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    initProductEvents();
}

function createProductCardHTML(p) {
    const isAr = state.lang === 'ar';
    const title = isAr ? (p.title_ar || p.title) : p.title;
    const desc = isAr ? (p.description_ar || p.description) : p.description;
    const badge = isAr ? (p.badge_ar || p.badge) : p.badge;
    const catName = isAr ? (p.category_name_ar || p.category_name_en) : (p.category_name_en || 'STREETWEAR');

    const hasSale = p.sale_price !== null && p.sale_price < p.price;
    const currentPrice = hasSale ? p.sale_price : p.price;
    const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['ONE SIZE'];

    return `
        <article class="product-card" data-id="${p.id}" tabindex="0" aria-label="${title}">
            ${badge ? `<span class="product-badge">${badge}</span>` : ''}
            <div class="product-image-wrap">
                <img class="product-image" src="${p.image_url || 'images/z-tee.jpg'}" alt="${title}" loading="lazy">
            </div>
            <div class="product-details">
                <span class="product-category-tag">${catName}</span>
                <h3 class="product-title">${title}</h3>
                <p class="product-desc">${desc || ''}</p>
                <div class="product-pricing">
                    <span class="current-price">${formatMoney(currentPrice)}</span>
                    ${hasSale ? `<span class="original-price">${formatMoney(p.price)}</span>` : ''}
                </div>
                <div class="product-options">
                    <div class="size-selector" id="size-selector-${p.id}">
                        ${sizes.map((s, idx) => `
                            <button type="button" class="size-chip ${idx === 0 ? 'selected' : ''}" data-size="${s}">${s}</button>
                        `).join('')}
                    </div>
                </div>
                <button class="btn-add-bag" data-action="add-bag" data-id="${p.id}">
                    <span>${isAr ? 'أضف للحقيبة' : 'ADD TO BAG'}</span>
                    <span>+</span>
                </button>
            </div>
        </article>
    `;
}

function initProductEvents() {
    // Size chip selection
    $$('.size-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const parent = chip.closest('.size-selector');
            parent.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
        });
    });

    // 3D tilt interaction
    $$('.product-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            const rotX = (y / (rect.height / 2)) * -5;
            const rotY = (x / (rect.width / 2)) * 5;
            card.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-8px) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// ====================================================================
// SHOPPING BAG & CHECKOUT
// ====================================================================
function renderCart() {
    const itemsContainer = $('#cart-items');
    const bagCount = $('#bag-count');
    const subtotalEl = $('#cart-subtotal');
    const discountRow = $('#cart-discount-row');
    const discountEl = $('#cart-discount');
    const grandTotalEl = $('#cart-grand-total');
    const checkoutBtn = $('#btn-checkout');

    if (!itemsContainer) return;

    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    bagCount.textContent = totalItems;

    const isAr = state.lang === 'ar';
    const t = window.I18N ? window.I18N[state.lang] : {};

    if (state.cart.length === 0) {
        itemsContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 60px 0; line-height: 1.8;">
                <p><strong>${t.cart_empty_1 || 'YOUR BAG IS CURRENTLY EMPTY.'}</strong></p>
                <p style="margin-top: 6px;">${t.cart_empty_2 || 'Find your signature aesthetic in the current drop.'}</p>
            </div>
        `;
        subtotalEl.textContent = formatMoney(0);
        grandTotalEl.textContent = formatMoney(0);
        if (discountRow) discountRow.style.display = 'none';
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = '0.4';
        return;
    }

    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = '1';

    let subtotal = 0;
    itemsContainer.innerHTML = state.cart.map(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        const title = isAr ? (item.title_ar || item.title) : item.title;

        return `
            <div class="cart-item-row" data-id="${item.productId}" data-size="${item.size}">
                <img class="cart-item-img" src="${item.image}" alt="${title}">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${title}</h4>
                    <div class="cart-item-meta">${isAr ? 'المقاس' : 'SIZE'}: ${item.size}</div>
                    <div class="cart-item-price">${formatMoney(item.price)}</div>
                    <div class="cart-item-actions">
                        <div class="qty-control">
                            <button class="qty-btn" data-action="decrease" data-id="${item.productId}" data-size="${item.size}" aria-label="Decrease quantity">−</button>
                            <span class="qty-display">${item.quantity}</span>
                            <button class="qty-btn" data-action="increase" data-id="${item.productId}" data-size="${item.size}" aria-label="Increase quantity">+</button>
                        </div>
                        <button class="item-remove-btn" data-action="remove" data-id="${item.productId}" data-size="${item.size}">${t.cart_remove || 'REMOVE'}</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    let discount = 0;
    if (state.appliedPromo) {
        if (state.appliedPromo.discount_type === 'percentage') {
            discount = (subtotal * state.appliedPromo.discount_value) / 100;
        } else {
            discount = state.appliedPromo.discount_value;
        }
        discount = Math.min(discount, subtotal);
        if (discountRow) {
            discountRow.style.display = 'flex';
            discountEl.textContent = `-${formatMoney(discount)}`;
        }
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }

    const grandTotal = subtotal - discount;
    subtotalEl.textContent = formatMoney(subtotal);
    grandTotalEl.textContent = formatMoney(grandTotal);

    localStorage.setItem('z_cart', JSON.stringify(state.cart));
}

function addToCart(productId) {
    const product = state.products.find(p => p.id === Number(productId));
    if (!product) return;

    const card = document.querySelector(`.product-card[data-id="${productId}"]`);
    const selectedSizeChip = card ? card.querySelector('.size-chip.selected') : null;
    const selectedSize = selectedSizeChip ? selectedSizeChip.dataset.size : (product.sizes[0] || 'ONE SIZE');
    const effectivePrice = product.sale_price !== null ? product.sale_price : product.price;

    const existingIndex = state.cart.findIndex(item => item.productId === product.id && item.size === selectedSize);
    if (existingIndex > -1) {
        state.cart[existingIndex].quantity += 1;
    } else {
        state.cart.push({
            productId: product.id,
            title: product.title,
            title_ar: product.title_ar,
            price: effectivePrice,
            image: product.image_url,
            size: selectedSize,
            quantity: 1
        });
    }

    renderCart();
    const t = window.I18N ? window.I18N[state.lang] : {};
    const itemTitle = state.lang === 'ar' ? (product.title_ar || product.title) : product.title;
    showToast(`${t.toast_added || 'ADDED TO BAG'}: ${itemTitle} (${selectedSize})`);
}

function updateCartQuantity(productId, size, delta) {
    const index = state.cart.findIndex(i => i.productId === Number(productId) && i.size === size);
    if (index > -1) {
        state.cart[index].quantity += delta;
        if (state.cart[index].quantity <= 0) {
            state.cart.splice(index, 1);
        }
        renderCart();
    }
}

function removeCartItem(productId, size) {
    state.cart = state.cart.filter(i => !(i.productId === Number(productId) && i.size === size));
    renderCart();
}

function openCartDrawer() {
    $('#cart-drawer').classList.add('active');
    $('#overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
    $('#cart-drawer').classList.remove('active');
    $('#checkout-modal').classList.remove('active');
    $('#overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// ====================================================================
// PROMO CODE & CHECKOUT
// ====================================================================
async function applyPromoCode(code) {
    const statusEl = $('#promo-status');
    if (!code) {
        statusEl.className = 'promo-status error';
        statusEl.textContent = state.lang === 'ar' ? 'يرجى إدخال كود الخصم.' : 'Please enter a promo code.';
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const isAr = state.lang === 'ar';
    const promo = state.promoCodes.find(p => String(p.code).toUpperCase() === code.toUpperCase());

    if (!promo) {
        state.appliedPromo = null;
        statusEl.className = 'promo-status error';
        statusEl.textContent = isAr ? 'كود غير صحيح أو منتهي.' : 'Invalid or expired code.';
    } else if (subtotal < Number(promo.min_order || 0)) {
        state.appliedPromo = null;
        statusEl.className = 'promo-status error';
        statusEl.textContent = isAr
            ? `الكود يحتاج طلب بحد أدنى ${formatMoney(promo.min_order)}`
            : `Requires minimum order of ${formatMoney(promo.min_order)}`;
    } else {
        state.appliedPromo = {
            code: promo.code,
            discount_type: promo.type === 'percentage' ? 'percentage' : 'fixed',
            discount_value: Number(promo.value) || 0
        };
        statusEl.className = 'promo-status success';
        statusEl.textContent = isAr ? `تم تطبيق الكود "${promo.code}" بنجاح!` : `Promo code "${promo.code}" applied!`;
    }
    renderCart();
}

function cartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let discount = 0;
    if (state.appliedPromo) {
        discount = state.appliedPromo.discount_type === 'percentage'
            ? (subtotal * state.appliedPromo.discount_value) / 100
            : state.appliedPromo.discount_value;
        discount = Math.min(discount, subtotal);
    }
    return { subtotal, discount, total: subtotal - discount };
}

// Builds the order text that the customer sends to the store on WhatsApp.
function buildWhatsAppMessage(order, orderNumber) {
    const isAr = state.lang === 'ar';
    const { subtotal, discount, total } = cartTotals();
    const lines = state.cart.map(item => {
        const title = isAr ? (item.title_ar || item.title) : item.title;
        return `• ${title} | ${isAr ? 'المقاس' : 'Size'}: ${item.size} | ×${item.quantity} = ${formatMoney(item.price * item.quantity)}`;
    });

    return [
        isAr ? `طلب جديد ${orderNumber}` : `New order ${orderNumber}`,
        '',
        ...lines,
        '',
        `${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}: ${formatMoney(subtotal)}`,
        ...(discount > 0 ? [`${isAr ? 'الخصم' : 'Discount'} (${state.appliedPromo.code}): -${formatMoney(discount)}`] : []),
        `${isAr ? 'الإجمالي' : 'Total'}: ${formatMoney(total)}`,
        '',
        `${isAr ? 'الاسم' : 'Name'}: ${order.name}`,
        `${isAr ? 'الموبايل' : 'Phone'}: ${order.phone}`,
        ...(order.email ? [`${isAr ? 'الإيميل' : 'Email'}: ${order.email}`] : []),
        `${isAr ? 'المحافظة' : 'City'}: ${order.city}`,
        `${isAr ? 'العنوان' : 'Address'}: ${order.address}`
    ].join('\n');
}

function handleCheckoutSubmit(e) {
    e.preventDefault();
    const isAr = state.lang === 'ar';

    // Egyptian numbers like 01012345678 become 201012345678 for wa.me links.
    let waNumber = String(state.settings.whatsapp_number || '').replace(/\D/g, '');
    if (waNumber.startsWith('0')) waNumber = '20' + waNumber.slice(1);
    if (waNumber.length < 10) {
        alert(isAr
            ? 'رقم واتساب المتجر لم يتم إعداده بعد. (whatsapp_number في ملف data/store.json)'
            : 'The store WhatsApp number is not set yet (whatsapp_number in data/store.json).');
        return;
    }

    const order = {
        name: $('#cust-name').value.trim(),
        email: $('#cust-email').value.trim(),
        phone: $('#cust-phone').value.trim(),
        address: $('#cust-address').value.trim(),
        city: $('#cust-city').value
    };

    const now = new Date();
    const orderNumber = `Z-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const message = buildWhatsAppMessage(order, orderNumber);
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');

    state.cart = [];
    state.appliedPromo = null;
    renderCart();

    const t = window.I18N ? window.I18N[state.lang] : {};
    const modal = $('#checkout-modal');
    const formMarkup = modal.innerHTML;
    modal.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 50px; color: var(--red); margin-bottom: 15px;">✓</div>
            <h3 style="font-size: 30px; color: var(--text-primary);">${t.order_success_title || 'ALMOST DONE.'}</h3>
            <p style="color: var(--text-muted); font-size: 13px; margin: 15px 0 25px;">
                ${t.order_success_ref || 'Order Ref'}: <strong style="color: var(--red);">${orderNumber}</strong>
            </p>
            <p style="color: var(--text-dim); font-size: 12px; line-height: 1.8;">
                ${t.order_success_body || ''}
            </p>
            <button id="btn-close-success" class="btn-primary" style="margin-top: 30px; width: 100%; justify-content: center;">
                ${t.order_success_btn || 'CONTINUE EXPLORING'}
            </button>
        </div>
    `;
    $('#btn-close-success').onclick = () => {
        // Put the checkout form back so the next order works without a page reload.
        modal.innerHTML = formMarkup;
        $('#checkout-form').reset();
        bindCheckoutModal();
        closeCartDrawer();
    };
}

function bindCheckoutModal() {
    $('#close-checkout-modal').addEventListener('click', () => {
        $('#checkout-modal').classList.remove('active');
        $('#cart-drawer').classList.add('active');
    });
    $('#checkout-form').addEventListener('submit', handleCheckoutSubmit);
}

// Toast
let toastTimer;
function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2800);
}

// ====================================================================
// EVENT SETUP
// ====================================================================
function setupEventListeners() {
    // Switchers
    $('#lang-toggle-btn').addEventListener('click', toggleLanguage);
    $('#theme-toggle-btn').addEventListener('click', toggleTheme);

    // Cart Drawer
    $('#bag-btn').addEventListener('click', openCartDrawer);
    $('#close-cart-btn').addEventListener('click', closeCartDrawer);
    $('#overlay').addEventListener('click', closeCartDrawer);

    // Search
    let searchTimer;
    $('#search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            fetchProducts();
        }, 250);
    });

    // Add to bag delegation
    $('#sections-product-container').addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-action="add-bag"]');
        if (addBtn) addToCart(addBtn.dataset.id);
    });

    // Cart actions
    $('#cart-items').addEventListener('click', (e) => {
        const dec = e.target.closest('[data-action="decrease"]');
        if (dec) { updateCartQuantity(dec.dataset.id, dec.dataset.size, -1); return; }

        const inc = e.target.closest('[data-action="increase"]');
        if (inc) { updateCartQuantity(inc.dataset.id, inc.dataset.size, 1); return; }

        const rem = e.target.closest('[data-action="remove"]');
        if (rem) { removeCartItem(rem.dataset.id, rem.dataset.size); return; }
    });

    // Promo
    $('#btn-apply-promo').addEventListener('click', () => {
        applyPromoCode($('#promo-input').value.trim());
    });

    // Checkout
    $('#btn-checkout').addEventListener('click', () => {
        $('#cart-drawer').classList.remove('active');
        $('#checkout-modal').classList.add('active');
    });

    bindCheckoutModal();

    // Escape Key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCartDrawer();
    });
}
