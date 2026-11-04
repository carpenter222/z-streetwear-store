// ====================================================================
// "Z" STREETWEAR - ADMIN DASHBOARD ENGINE (ADVANCED PRODUCT & SECTION CONTROL)
// ====================================================================

const adminState = {
    token: localStorage.getItem('z_admin_token'),
    theme: localStorage.getItem('z_admin_theme') || 'dark',
    user: null,
    currentTab: 'overview',
    metrics: {},
    products: [],
    sections: [],
    categories: [],
    orders: [],
    promotions: [],
    settings: {},
    editingProductId: null,
    reorderingProductId: null
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const formatMoney = (amount) => {
    return 'EGP ' + Number(amount || 0).toLocaleString('en-EG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
};

// ====================================================================
// INITIALIZATION & AUTH
// ====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupAdminEvents();
    if (adminState.token) {
        const isValid = await verifyAuthToken();
        if (isValid) {
            hideLoginScreen();
            await loadInitialDashboardData();
        } else {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
});

function initTheme() {
    document.documentElement.dataset.theme = adminState.theme;
}

function toggleTheme() {
    adminState.theme = adminState.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('z_admin_theme', adminState.theme);
    document.documentElement.dataset.theme = adminState.theme;
    $('#admin-theme-btn').textContent = adminState.theme === 'dark' ? '☀️ LIGHT' : '🌙 DARK';
}

function showLoginScreen() {
    $('#login-screen').style.display = 'flex';
}

function hideLoginScreen() {
    $('#login-screen').style.display = 'none';
}

async function verifyAuthToken() {
    try {
        const res = await fetch('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${adminState.token}` }
        });
        const data = await res.json();
        if (data.success) {
            adminState.user = data.user;
            $('#admin-username-display').textContent = data.user.username.toUpperCase();
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = $('#login-user').value.trim();
    const password = $('#login-pass').value;
    const errorEl = $('#login-error');
    const submitBtn = $('#btn-login-submit');

    errorEl.textContent = '';
    submitBtn.textContent = 'AUTHENTICATING...';
    submitBtn.disabled = true;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success && data.token) {
            adminState.token = data.token;
            adminState.user = data.user;
            localStorage.setItem('z_admin_token', data.token);
            $('#admin-username-display').textContent = data.user.username.toUpperCase();
            hideLoginScreen();
            await loadInitialDashboardData();
        } else {
            errorEl.textContent = data.error || 'Invalid credentials.';
        }
    } catch {
        errorEl.textContent = 'Failed to connect to authentication server.';
    } finally {
        submitBtn.textContent = 'ACCESS DASHBOARD ↗';
        submitBtn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem('z_admin_token');
    adminState.token = null;
    adminState.user = null;
    showLoginScreen();
}

async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${adminState.token}`;
    if (options.body && typeof options.body === 'object') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired');
    }
    return res.json();
}

// ====================================================================
// DATA LOADING
// ====================================================================
async function loadInitialDashboardData() {
    await fetchSections();
    await fetchCategories();
    await fetchMetrics();
    await fetchProducts();
    await fetchOrders();
    await fetchPromotions();
    await fetchSettings();
    renderOverview();
}

async function fetchMetrics() {
    try {
        const data = await authFetch('/api/settings/metrics');
        if (data.success) {
            adminState.metrics = data.metrics;
            adminState.recentOrders = data.recentOrders;
            updateMetricsUI();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchSections() {
    try {
        const res = await fetch('/api/settings/sections');
        const data = await res.json();
        if (data.success) {
            adminState.sections = data.sections;
            populateSectionSelects();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (data.success) {
            adminState.categories = data.categories;
            populateCategorySelect();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchProducts() {
    try {
        const data = await authFetch('/api/products?activeOnly=0');
        if (data.success) {
            adminState.products = data.products;
            if (adminState.currentTab === 'products') renderProductsTable();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchOrders() {
    try {
        const data = await authFetch('/api/orders');
        if (data.success) {
            adminState.orders = data.orders;
            if (adminState.currentTab === 'orders') renderOrdersTable();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchPromotions() {
    try {
        const data = await authFetch('/api/promotions');
        if (data.success) {
            adminState.promotions = data.promotions;
            if (adminState.currentTab === 'promotions') renderPromotionsTable();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success) {
            adminState.settings = data.settings;
            populateSettingsUI();
        }
    } catch (err) {
        console.error(err);
    }
}

// ====================================================================
// TAB NAVIGATION & METRICS
// ====================================================================
function switchTab(tabId) {
    adminState.currentTab = tabId;
    $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    $$('.admin-tab-pane').forEach(pane => pane.style.display = 'none');

    const activePane = $(`#tab-${tabId}`);
    if (activePane) activePane.style.display = 'block';

    if (tabId === 'overview') {
        fetchMetrics();
        renderOverview();
    } else if (tabId === 'products') {
        renderProductsTable();
    } else if (tabId === 'orders') {
        renderOrdersTable();
    } else if (tabId === 'promotions') {
        renderPromotionsTable();
        populateSettingsUI();
    }
}

function updateMetricsUI() {
    const m = adminState.metrics;
    $('#metric-sales').textContent = formatMoney(m.totalSales || 0);
    $('#metric-orders').textContent = m.totalOrders || 0;
    $('#metric-pending').textContent = m.pendingOrders || 0;
    $('#metric-low-stock').textContent = m.lowStockCount || 0;
}

function renderOverview() {
    updateMetricsUI();
    const tbody = $('#overview-orders-tbody');
    if (!tbody) return;

    const orders = adminState.recentOrders || [];
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-gray); padding: 30px;">No orders logged yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td style="font-family: var(--font-mono); font-weight: 700;">${o.order_number}</td>
            <td>${o.customer_name}</td>
            <td><strong>${formatMoney(o.total_amount)}</strong></td>
            <td><span class="badge-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// ====================================================================
// PRODUCTS MANAGEMENT (WITH SECTION, POSITION & PRICE CONTROL)
// ====================================================================
function renderProductsTable() {
    const tbody = $('#products-table-tbody');
    if (!tbody) return;

    if (adminState.products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-gray); padding: 30px;">No products in database.</td></tr>`;
        return;
    }

    tbody.innerHTML = adminState.products.map(p => {
        const sec = adminState.sections.find(s => s.key === p.section_key);
        const sectionName = sec ? sec.name_en : (p.section_key || 'featured');

        return `
            <tr>
                <td>
                    <img class="product-thumb" src="${p.image_url || '/images/z-tee.jpg'}" alt="${p.title}">
                </td>
                <td>
                    <div style="font-weight: 800; color: var(--text-white);">${p.title}</div>
                    <div style="font-size: 11px; color: var(--text-gray); font-family: var(--font-ar);">${p.title_ar || ''}</div>
                    <small style="color: var(--text-dim);">${p.category_name_en || 'Streetwear'}</small>
                </td>
                <td>
                    <span class="section-tag-pill">📁 ${sectionName}</span>
                </td>
                <td>
                    <span class="order-badge-pill" title="Display Order Position">${p.display_order || 0}</span>
                </td>
                <td>
                    ${p.sale_price !== null && p.sale_price < p.price
                        ? `<span style="color: var(--red); font-weight: 800;">${formatMoney(p.sale_price)}</span> <s style="color: var(--text-dim); font-size: 10px;">${formatMoney(p.price)}</s>`
                        : `<strong>${formatMoney(p.price)}</strong>`}
                </td>
                <td>
                    <span class="stock-indicator ${p.stock <= 5 ? 'low' : ''}">${p.stock} in stock</span>
                </td>
                <td>
                    <span class="badge-pill" style="background: ${p.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${p.is_active ? '#10b981' : '#ef4444'};">
                        ${p.is_active ? 'ACTIVE' : 'HIDDEN'}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-tbl-action reorder" onclick="openReorderModal(${p.id})" title="Move Section or Change Position">⇄ SECTION & ORDER</button>
                        <button class="btn-tbl-action" onclick="openEditProductModal(${p.id})">EDIT</button>
                        <button class="btn-tbl-action danger" onclick="deleteProduct(${p.id})">DELETE</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function populateSectionSelects() {
    const selProduct = $('#product-section-key');
    const selReorder = $('#reorder-section-key');

    const options = adminState.sections.map(s => `
        <option value="${s.key}">${s.name_en} (${s.name_ar})</option>
    `).join('');

    if (selProduct) selProduct.innerHTML = options;
    if (selReorder) selReorder.innerHTML = options;
}

function populateCategorySelect() {
    const sel = $('#product-category-id');
    if (!sel) return;
    sel.innerHTML = adminState.categories.map(c => `
        <option value="${c.id}">${c.name_en} (${c.name_ar})</option>
    `).join('');
}

function openAddProductModal() {
    adminState.editingProductId = null;
    $('#product-modal-title').textContent = 'NEW STREETWEAR DROP';
    $('#product-form').reset();
    $('#product-image-url').value = '/images/z-tee.jpg';
    $('#modal-product-overlay').classList.add('active');
}

function openEditProductModal(productId) {
    const p = adminState.products.find(item => item.id === productId);
    if (!p) return;

    adminState.editingProductId = p.id;
    $('#product-modal-title').textContent = `EDIT DROP: ${p.title}`;

    $('#product-title').value = p.title;
    $('#product-title-ar').value = p.title_ar || '';
    $('#product-category-id').value = p.category_id || (adminState.categories[0] ? adminState.categories[0].id : '');
    $('#product-section-key').value = p.section_key || 'featured';
    $('#product-display-order').value = p.display_order || 0;
    $('#product-price').value = p.price;
    $('#product-sale-price').value = p.sale_price || '';
    $('#product-badge').value = p.badge || 'NEW DROP';
    $('#product-badge-ar').value = p.badge_ar || 'إصدار جديد';
    $('#product-stock').value = p.stock;
    $('#product-image-url').value = p.image_url || '';
    $('#product-sizes').value = (p.sizes || []).join(', ');
    $('#product-desc').value = p.description || '';
    $('#product-desc-ar').value = p.description_ar || '';
    $('#product-active').value = p.is_active !== undefined ? p.is_active : 1;

    $('#modal-product-overlay').classList.add('active');
}

function closeProductModal() {
    $('#modal-product-overlay').classList.remove('active');
}

// Quick Section & Position Mover Modal
function openReorderModal(productId) {
    const p = adminState.products.find(item => item.id === productId);
    if (!p) return;

    adminState.reorderingProductId = p.id;
    $('#reorder-product-name').textContent = p.title;
    $('#reorder-section-key').value = p.section_key || 'featured';
    $('#reorder-display-order').value = p.display_order || 0;
    $('#reorder-price').value = p.price;
    $('#reorder-sale-price').value = p.sale_price || '';

    $('#modal-reorder-overlay').classList.add('active');
}

function closeReorderModal() {
    $('#modal-reorder-overlay').classList.remove('active');
}

async function handleSaveReorder(e) {
    e.preventDefault();
    const btn = $('#btn-save-reorder');
    btn.disabled = true;

    const payload = {
        section_key: $('#reorder-section-key').value,
        display_order: Number($('#reorder-display-order').value) || 0,
        price: Number($('#reorder-price').value),
        sale_price: $('#reorder-sale-price').value ? Number($('#reorder-sale-price').value) : null
    };

    try {
        await authFetch(`/api/products/${adminState.reorderingProductId}`, {
            method: 'PUT',
            body: payload
        });
        closeReorderModal();
        await fetchProducts();
    } catch (err) {
        alert('Failed to update placement: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const btn = $('#btn-save-product');
    btn.disabled = true;

    const sizesRaw = $('#product-sizes').value.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
        title: $('#product-title').value.trim(),
        title_ar: $('#product-title-ar').value.trim(),
        category_id: Number($('#product-category-id').value),
        section_key: $('#product-section-key').value,
        display_order: Number($('#product-display-order').value) || 0,
        price: Number($('#product-price').value),
        sale_price: $('#product-sale-price').value ? Number($('#product-sale-price').value) : null,
        badge: $('#product-badge').value.trim(),
        badge_ar: $('#product-badge-ar').value.trim(),
        stock: Number($('#product-stock').value),
        image_url: $('#product-image-url').value.trim(),
        sizes: sizesRaw.length ? sizesRaw : ['ONE SIZE'],
        description: $('#product-desc').value.trim(),
        description_ar: $('#product-desc-ar').value.trim(),
        is_active: Number($('#product-active').value)
    };

    try {
        if (adminState.editingProductId) {
            await authFetch(`/api/products/${adminState.editingProductId}`, {
                method: 'PUT',
                body: payload
            });
        } else {
            await authFetch('/api/products', {
                method: 'POST',
                body: payload
            });
        }

        closeProductModal();
        await fetchProducts();
        await fetchMetrics();
    } catch (err) {
        alert('Failed to save product: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this piece from the database?')) return;
    try {
        await authFetch(`/api/products/${id}`, { method: 'DELETE' });
        await fetchProducts();
        await fetchMetrics();
    } catch (err) {
        alert('Could not delete product: ' + err.message);
    }
}

// Preset image helper
function setPresetImage(url) {
    $('#product-image-url').value = url;
}

// ====================================================================
// ORDERS MANAGEMENT
// ====================================================================
function renderOrdersTable() {
    const tbody = $('#orders-table-tbody');
    if (!tbody) return;

    if (adminState.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-gray); padding: 30px;">No incoming customer orders.</td></tr>`;
        return;
    }

    tbody.innerHTML = adminState.orders.map(o => `
        <tr>
            <td style="font-family: var(--font-mono); font-weight: 800;">${o.order_number}</td>
            <td>
                <div style="font-weight: 700; color: var(--text-white);">${o.customer_name}</div>
                <small style="color: var(--text-gray);">${o.phone} · ${o.city} (${o.language ? o.language.toUpperCase() : 'EN'})</small>
            </td>
            <td>
                <span>${(o.items || []).length} items</span>
            </td>
            <td>
                <strong style="color: var(--red);">${formatMoney(o.total_amount)}</strong>
                ${o.discount_amount > 0 ? `<div style="font-size: 9px; color: #10b981;">Saved: ${formatMoney(o.discount_amount)}</div>` : ''}
            </td>
            <td>
                <select class="badge-pill status-${o.status.toLowerCase()}" onchange="updateOrderStatus(${o.id}, this.value)" style="border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated); padding: 4px 6px;">
                    <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
                    <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td style="font-size: 11px; color: var(--text-gray);">${new Date(o.created_at).toLocaleString()}</td>
            <td>
                <button class="btn-tbl-action" onclick="openOrderDetailsModal(${o.id})">VIEW DETAILS</button>
            </td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await authFetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: { status: newStatus }
        });
        await fetchOrders();
        await fetchMetrics();
    } catch {
        alert('Failed to update order status');
    }
}

function openOrderDetailsModal(orderId) {
    const o = adminState.orders.find(item => item.id === orderId);
    if (!o) return;

    $('#order-modal-title').textContent = `ORDER ${o.order_number}`;
    $('#order-modal-content').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; background: var(--bg-surface-elevated); padding: 18px; border-radius: 4px;">
            <div>
                <small style="color: var(--text-gray); text-transform: uppercase;">Customer Info</small>
                <div style="font-weight: 800; margin-top: 4px; font-size: 14px;">${o.customer_name}</div>
                <div style="color: var(--text-gray); font-size: 12px;">${o.email}</div>
                <div style="color: var(--text-gray); font-size: 12px;">${o.phone}</div>
            </div>
            <div>
                <small style="color: var(--text-gray); text-transform: uppercase;">Shipping Address</small>
                <div style="font-size: 13px; margin-top: 4px; font-weight: 700;">${o.city}</div>
                <div style="color: var(--text-gray); font-size: 12px;">${o.address}</div>
            </div>
        </div>

        <h4 style="font-family: var(--font-heading); font-size: 18px; margin-bottom: 12px;">ORDER ITEMS (${(o.items || []).length})</h4>
        <div style="border-top: 1px solid var(--border-subtle);">
            ${(o.items || []).map(it => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
                    <div>
                        <div style="font-weight: 800;">${it.product_title}</div>
                        <div style="font-size: 11px; color: var(--text-gray);">Size: ${it.selected_size || 'N/A'} · Qty: ${it.quantity}</div>
                    </div>
                    <div style="font-weight: 800; color: var(--red);">${formatMoney(it.total_price)}</div>
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; font-size: 16px;">
            <span style="font-weight: 800;">TOTAL CHARGED</span>
            <span style="font-weight: 900; color: var(--red);">${formatMoney(o.total_amount)}</span>
        </div>
    `;

    $('#modal-order-overlay').classList.add('active');
}

function closeOrderDetailsModal() {
    $('#modal-order-overlay').classList.remove('active');
}

// ====================================================================
// PROMOTIONS & SETTINGS
// ====================================================================
function renderPromotionsTable() {
    const tbody = $('#promotions-table-tbody');
    if (!tbody) return;

    if (adminState.promotions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-gray); padding: 25px;">No active promotions.</td></tr>`;
        return;
    }

    tbody.innerHTML = adminState.promotions.map(promo => `
        <tr>
            <td style="font-family: var(--font-mono); font-weight: 800; color: var(--text-white);">${promo.code}</td>
            <td style="text-transform: capitalize;">${promo.discount_type}</td>
            <td><strong>${promo.discount_type === 'percentage' ? promo.discount_value + '%' : formatMoney(promo.discount_value)}</strong></td>
            <td>${formatMoney(promo.min_order_amount)}</td>
            <td>
                <span class="badge-pill ${promo.is_active ? 'status-delivered' : 'status-cancelled'}" style="cursor: pointer;" onclick="togglePromotion(${promo.id}, ${promo.is_active ? 0 : 1})">
                    ${promo.is_active ? 'ACTIVE' : 'DISABLED'}
                </span>
            </td>
            <td>
                <button class="btn-tbl-action danger" onclick="deletePromotion(${promo.id})">DELETE</button>
            </td>
        </tr>
    `).join('');
}

async function handleCreatePromo(e) {
    e.preventDefault();
    const payload = {
        code: $('#promo-new-code').value.trim().toUpperCase(),
        discount_type: $('#promo-new-type').value,
        discount_value: Number($('#promo-new-value').value),
        min_order_amount: Number($('#promo-new-min').value) || 0,
        is_active: 1
    };

    try {
        await authFetch('/api/promotions', {
            method: 'POST',
            body: payload
        });
        $('#promo-form').reset();
        await fetchPromotions();
    } catch (err) {
        alert('Could not create promo: ' + err.message);
    }
}

async function togglePromotion(id, newStatus) {
    try {
        await authFetch(`/api/promotions/${id}`, {
            method: 'PUT',
            body: { is_active: newStatus }
        });
        await fetchPromotions();
    } catch {
        alert('Failed to toggle promotion');
    }
}

async function deletePromotion(id) {
    if (!confirm('Delete this coupon code?')) return;
    try {
        await authFetch(`/api/promotions/${id}`, { method: 'DELETE' });
        await fetchPromotions();
    } catch (err) {
        alert('Failed to delete promotion: ' + err.message);
    }
}

function populateSettingsUI() {
    const s = adminState.settings;
    if ($('#setting-announcement-en')) $('#setting-announcement-en').value = s.announcement_en || '';
    if ($('#setting-announcement-ar')) $('#setting-announcement-ar').value = s.announcement_ar || '';
    if ($('#setting-ticker-en')) $('#setting-ticker-en').value = s.ticker_en || '';
    if ($('#setting-ticker-ar')) $('#setting-ticker-ar').value = s.ticker_ar || '';
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const btn = $('#btn-save-settings');
    btn.disabled = true;

    const payload = {
        settings: {
            announcement_en: $('#setting-announcement-en').value.trim(),
            announcement_ar: $('#setting-announcement-ar').value.trim(),
            ticker_en: $('#setting-ticker-en').value.trim(),
            ticker_ar: $('#setting-ticker-ar').value.trim()
        }
    };

    try {
        await authFetch('/api/settings', {
            method: 'PUT',
            body: payload
        });
        alert('✓ Headlines and banner texts updated successfully!');
        await fetchSettings();
    } catch (err) {
        alert('Failed to update settings: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

// ====================================================================
// EVENT SETUP
// ====================================================================
function setupAdminEvents() {
    $('#login-form').addEventListener('submit', handleLogin);
    $('#btn-admin-logout').addEventListener('click', handleLogout);
    $('#admin-theme-btn').addEventListener('click', toggleTheme);

    $$('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('#btn-open-add-product').addEventListener('click', openAddProductModal);
    $('#close-product-modal').addEventListener('click', closeProductModal);
    $('#product-form').addEventListener('submit', handleSaveProduct);

    $('#close-reorder-modal').addEventListener('click', closeReorderModal);
    $('#reorder-form').addEventListener('submit', handleSaveReorder);

    $('#close-order-modal').addEventListener('click', closeOrderDetailsModal);
    $('#promo-form').addEventListener('submit', handleCreatePromo);
    $('#settings-form').addEventListener('submit', handleSaveSettings);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeReorderModal();
            closeOrderDetailsModal();
        }
    });
}
