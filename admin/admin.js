// ====================================================================
// Z STORE ADMIN — edits data/products.json and data/store.json
// directly in the GitHub repository. No server needed: GitHub Pages
// republishes the site after every save.
// ====================================================================

const PRODUCTS_PATH = 'data/products.json';
const STORE_PATH = 'data/store.json';
const CREDS_KEY = 'z_admin_github';

const $ = (s) => document.querySelector(s);

const app = {
    creds: null,           // { owner, repo, token, branch }
    products: [],
    store: {},
    shas: {},              // last known file versions on GitHub
    saved: { products: '', store: '' }, // JSON as last published, to detect unsaved edits
    editingId: null,
    pendingImage: null,    // { path, previewUrl } for the product form
    localPreviews: {}      // image path -> data URL, for images not yet live on the site
};

// ---------- small helpers ----------
const escapeHTML = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`;

function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', isError);
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), isError ? 6000 : 3000);
}

function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}
const textToBase64 = (text) => bytesToBase64(new TextEncoder().encode(text));
const base64ToText = (b64) => {
    const bin = atob(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

// ---------- GitHub API ----------
async function gh(path, options = {}) {
    const { owner, repo, token } = app.creds;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(options.body ? { 'Content-Type': 'application/json' } : {})
        }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || `GitHub error ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

function friendlyError(err) {
    if (err.status === 401) return 'مفتاح الدخول غلط أو انتهت صلاحيته. اعمل مفتاح جديد.';
    if (err.status === 403) return 'المفتاح مش معاه صلاحية تعديل. اتأكد إن Contents = Read and write.';
    if (err.status === 404) return 'مش لاقي الـ repository أو الملف. اتأكد من اسم الحساب واسم الـ repository، وإن المفتاح مسموح له بيه.';
    if (err.status === 409 || err.status === 422) return 'الملف اتغيّر من مكان تاني. اعمل تحديث للصفحة (Refresh) وجرّب تاني.';
    if (err instanceof TypeError) return 'مفيش إنترنت أو GitHub مش بيرد. جرّب تاني.';
    return `حصلت مشكلة: ${err.message}`;
}

async function readJSONFile(path) {
    const file = await gh(`/contents/${path}?ref=${encodeURIComponent(app.creds.branch)}`);
    app.shas[path] = file.sha;
    return JSON.parse(base64ToText(file.content));
}

async function writeFile(path, base64Content, message) {
    const body = { message, content: base64Content, branch: app.creds.branch };
    if (app.shas[path]) body.sha = app.shas[path];
    const res = await gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
    app.shas[path] = res.content.sha;
    return res;
}

// ---------- login ----------
function guessRepoFromURL() {
    // On GitHub Pages the address is https://OWNER.github.io/REPO/admin/
    const host = location.hostname;
    if (!host.endsWith('.github.io')) return {};
    const owner = host.replace('.github.io', '');
    const first = location.pathname.split('/').filter(Boolean)[0];
    const repo = first && first !== 'admin' ? first : host;
    return { owner, repo };
}

async function connect(creds) {
    app.creds = { branch: 'main', ...creds };
    const repoInfo = await gh('');
    app.creds.branch = repoInfo.default_branch || 'main';
    if (repoInfo.permissions && !repoInfo.permissions.push) {
        const err = new Error('no push'); err.status = 403; throw err;
    }
    const [products, store] = await Promise.all([readJSONFile(PRODUCTS_PATH), readJSONFile(STORE_PATH)]);
    app.products = products;
    app.store = store;
    markSaved('products');
    markSaved('store');
}

function showLogin(errorMsg = '') {
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    const saved = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null') || {};
    const guess = guessRepoFromURL();
    $('#login-owner').value = saved.owner || guess.owner || '';
    $('#login-repo').value = saved.repo || guess.repo || '';
    $('#login-error').textContent = errorMsg;
}

function showApp() {
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    renderProducts();
    renderStoreForm();
    updatePublishBar();
}

$('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    btn.disabled = true;
    btn.textContent = 'جاري الدخول...';
    $('#login-error').textContent = '';
    const creds = {
        owner: $('#login-owner').value.trim(),
        repo: $('#login-repo').value.trim(),
        token: $('#login-token').value.trim()
    };
    try {
        await connect(creds);
        localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
        $('#login-token').value = '';
        showApp();
    } catch (err) {
        $('#login-error').textContent = friendlyError(err);
    } finally {
        btn.disabled = false;
        btn.textContent = 'دخول';
    }
});

$('#logout-btn').addEventListener('click', () => {
    if (hasUnsaved() && !confirm('عندك تعديلات ما اتنشرتش. تخرج برضه؟')) return;
    localStorage.removeItem(CREDS_KEY);
    app.saved = { products: '', store: '' };
    location.reload();
});

// ---------- unsaved changes / publish ----------
const snapshot = (kind) => JSON.stringify(kind === 'products' ? app.products : app.store);
function markSaved(kind) { app.saved[kind] = snapshot(kind); }
const isDirty = (kind) => app.saved[kind] !== snapshot(kind);
const hasUnsaved = () => app.creds && (isDirty('products') || isDirty('store'));

function updatePublishBar() {
    $('#publish-bar').hidden = !hasUnsaved();
}

window.addEventListener('beforeunload', (e) => {
    if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; }
});

$('#publish-btn').addEventListener('click', async () => {
    const btn = $('#publish-btn');
    btn.disabled = true;
    btn.textContent = 'جاري النشر...';
    if (app.store.promo_codes) app.store.promo_codes = app.store.promo_codes.filter(p => p.code);
    try {
        if (isDirty('products')) {
            await writeFile(PRODUCTS_PATH, textToBase64(JSON.stringify(app.products, null, 2) + '\n'), 'تحديث المنتجات من لوحة الإدارة');
            markSaved('products');
        }
        if (isDirty('store')) {
            await writeFile(STORE_PATH, textToBase64(JSON.stringify(app.store, null, 2) + '\n'), 'تحديث إعدادات المتجر من لوحة الإدارة');
            markSaved('store');
        }
        toast('تم النشر ✓ التعديلات هتظهر على الموقع في خلال دقيقة أو اتنين.');
    } catch (err) {
        toast(friendlyError(err), true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'نشر على الموقع';
        renderPromos();
        updatePublishBar();
    }
});

$('#discard-btn').addEventListener('click', () => {
    if (!confirm('هتلغي كل التعديلات اللي ما اتنشرتش. متأكد؟')) return;
    app.products = JSON.parse(app.saved.products);
    app.store = JSON.parse(app.saved.store);
    renderProducts();
    renderStoreForm();
    updatePublishBar();
});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        $('#tab-products').hidden = tab.dataset.tab !== 'products';
        $('#tab-store').hidden = tab.dataset.tab !== 'store';
    });
});

// ---------- products list ----------
const categoryName = (slug) => (app.store.categories || []).find(c => c.slug === slug)?.name_ar || slug || '—';
const sectionName = (key) => (app.store.sections || []).find(s => s.key === key)?.name_ar || key || '—';
const imageSrc = (path) => app.localPreviews[path] || `../${String(path || '').replace(/^\/+/, '')}`;

function renderProducts() {
    const q = $('#product-search').value.trim().toLowerCase();
    const list = $('#product-list');
    $('#product-count').textContent = `(${app.products.length})`;

    const rows = app.products
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => !q || [p.name_ar, p.name_en].some(v => String(v || '').toLowerCase().includes(q)));

    if (!rows.length) {
        list.innerHTML = `<p class="empty">${q ? 'مفيش منتجات بالاسم ده.' : 'مفيش منتجات لسه. دوس "منتج جديد".'}</p>`;
        return;
    }

    list.innerHTML = rows.map(({ p, index }) => {
        const hasSale = p.sale_price !== null && p.sale_price !== undefined && p.sale_price !== '' && Number(p.sale_price) < Number(p.price);
        const visible = p.visible !== false;
        return `
        <div class="product-row ${visible ? '' : 'hidden-product'}">
            <img src="${escapeHTML(imageSrc(p.image))}" alt="" loading="lazy">
            <div class="product-info">
                <strong>${escapeHTML(p.name_ar || p.name_en)}</strong>
                <div class="product-meta">
                    ${hasSale
                        ? `<span class="price-sale">${money(p.sale_price)}</span><span class="price-old">${money(p.price)}</span>`
                        : `<span>${money(p.price)}</span>`}
                    <span>${escapeHTML(categoryName(p.category))}</span>
                    <span>${escapeHTML(sectionName(p.section))}</span>
                    ${visible ? '' : '<span class="pill pill-off">مخفي</span>'}
                </div>
            </div>
            <div class="row-actions">
                <button class="icon-btn" data-act="up" data-i="${index}" aria-label="لفوق" ${index === 0 || q ? 'disabled' : ''}>▲</button>
                <button class="icon-btn" data-act="down" data-i="${index}" aria-label="لتحت" ${index === app.products.length - 1 || q ? 'disabled' : ''}>▼</button>
                <button class="btn btn-ghost btn-sm" data-act="edit" data-i="${index}">تعديل</button>
                <button class="btn btn-ghost btn-sm" data-act="toggle" data-i="${index}">${visible ? 'إخفاء' : 'إظهار'}</button>
                <button class="btn btn-danger btn-sm" data-act="delete" data-i="${index}">مسح</button>
            </div>
        </div>`;
    }).join('');
}

$('#product-search').addEventListener('input', renderProducts);

$('#product-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    const p = app.products[i];

    switch (btn.dataset.act) {
        case 'up':
        case 'down': {
            const j = btn.dataset.act === 'up' ? i - 1 : i + 1;
            [app.products[i], app.products[j]] = [app.products[j], app.products[i]];
            break;
        }
        case 'toggle':
            p.visible = p.visible === false;
            break;
        case 'delete':
            if (!confirm(`هتمسح "${p.name_ar || p.name_en}" نهائي. متأكد؟\n(لو عايز تخبيه بس، دوس "إخفاء")`)) return;
            app.products.splice(i, 1);
            break;
        case 'edit':
            openProductForm(p);
            return;
    }
    renderProducts();
    updatePublishBar();
});

// ---------- product form ----------
function fillSelect(select, items, valueKey, current) {
    select.innerHTML = items.map(it =>
        `<option value="${escapeHTML(it[valueKey])}">${escapeHTML(it.name_ar || it.name_en)}</option>`
    ).join('');
    if (current) select.value = current;
}

function openProductForm(product = null) {
    app.editingId = product ? product.id : null;
    app.pendingImage = null;
    $('#product-form').reset();
    $('#pf-error').textContent = '';
    $('#pf-image-status').textContent = '';
    $('#product-dialog-title').textContent = product ? 'تعديل منتج' : 'منتج جديد';

    fillSelect($('#pf-category'), app.store.categories || [], 'slug', product?.category);
    fillSelect($('#pf-section'), app.store.sections || [], 'key', product?.section);

    const p = product || {};
    $('#pf-name-ar').value = p.name_ar || '';
    $('#pf-name-en').value = p.name_en || '';
    $('#pf-desc-ar').value = p.description_ar || '';
    $('#pf-desc-en').value = p.description_en || '';
    $('#pf-price').value = p.price ?? '';
    $('#pf-sale').value = p.sale_price ?? '';
    $('#pf-sizes').value = (p.sizes || []).join(', ');
    $('#pf-badge-ar').value = p.badge_ar || '';
    $('#pf-badge-en').value = p.badge_en || '';
    $('#pf-visible').checked = p.visible !== false;

    const preview = $('#pf-preview');
    preview.hidden = !p.image;
    if (p.image) preview.src = imageSrc(p.image);
    $('#pf-image-label').textContent = p.image ? 'تغيير الصورة' : 'اختار صورة';

    $('#product-dialog').showModal();
}

const closeProductForm = () => $('#product-dialog').close();
$('#add-product-btn').addEventListener('click', () => openProductForm());
$('#close-dialog').addEventListener('click', closeProductForm);
$('#cancel-product').addEventListener('click', closeProductForm);

// Shrinks big phone photos so the site stays fast. Returns { blob, ext }.
async function prepareImage(file) {
    const keepPng = file.type === 'image/png';
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const type = keepPng ? 'image/png' : 'image/jpeg';
        const blob = await new Promise(res => canvas.toBlob(res, type, 0.85));
        if (blob && blob.size < file.size) return { blob, ext: keepPng ? 'png' : 'jpg' };
    } catch { /* fall back to the original file */ }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    return { blob: file, ext };
}

const blobToDataURL = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
});

$('#pf-image-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $('#pf-image-status');
    const saveBtn = $('#save-product');
    saveBtn.disabled = true;
    status.textContent = 'جاري رفع الصورة...';
    try {
        const { blob, ext } = await prepareImage(file);
        if (blob.size > 20 * 1024 * 1024) throw new Error('الصورة كبيرة جداً (أكتر من 20 ميجا).');
        const dataURL = await blobToDataURL(blob);
        const path = `images/products/p-${Date.now()}.${ext}`;
        await writeFile(path, dataURL.split(',')[1], `رفع صورة منتج ${path}`);
        app.localPreviews[path] = dataURL;
        app.pendingImage = { path };
        const preview = $('#pf-preview');
        preview.src = dataURL;
        preview.hidden = false;
        status.textContent = 'تم رفع الصورة ✓';
    } catch (err) {
        status.textContent = err.status ? friendlyError(err) : err.message;
    } finally {
        saveBtn.disabled = false;
        e.target.value = '';
    }
});

$('#product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#pf-error');
    const existing = app.products.find(p => p.id === app.editingId);
    const image = app.pendingImage?.path || existing?.image;

    const price = Number($('#pf-price').value);
    const saleRaw = $('#pf-sale').value.trim();
    const sale = saleRaw === '' ? null : Number(saleRaw);

    if (!image) { err.textContent = 'لازم تختار صورة للمنتج.'; return; }
    if (sale !== null && sale >= price) { err.textContent = 'سعر الخصم لازم يكون أقل من السعر الأصلي.'; return; }

    const sizes = $('#pf-sizes').value.split(/[,،]/).map(s => s.trim()).filter(Boolean);
    const data = {
        id: existing ? existing.id : Math.max(0, ...app.products.map(p => Number(p.id) || 0)) + 1,
        name_en: $('#pf-name-en').value.trim(),
        name_ar: $('#pf-name-ar').value.trim(),
        description_en: $('#pf-desc-en').value.trim(),
        description_ar: $('#pf-desc-ar').value.trim(),
        price,
        sale_price: sale,
        badge_en: $('#pf-badge-en').value.trim(),
        badge_ar: $('#pf-badge-ar').value.trim(),
        category: $('#pf-category').value,
        section: $('#pf-section').value,
        sizes: sizes.length ? sizes : ['ONE SIZE'],
        image,
        visible: $('#pf-visible').checked
    };

    if (existing) {
        app.products[app.products.indexOf(existing)] = data;
    } else {
        app.products.unshift(data);
    }

    closeProductForm();
    renderProducts();
    updatePublishBar();
    toast(existing ? 'اتعدّل. دوس "نشر على الموقع" عشان يظهر.' : 'اتضاف. دوس "نشر على الموقع" عشان يظهر.');
});

// ---------- store settings ----------
const storeFields = {
    '#set-whatsapp': 'whatsapp_number',
    '#set-ann-ar': 'announcement_ar',
    '#set-ann-en': 'announcement_en',
    '#set-ticker-ar': 'ticker_ar',
    '#set-ticker-en': 'ticker_en'
};

function renderStoreForm() {
    for (const [sel, key] of Object.entries(storeFields)) $(sel).value = app.store[key] || '';
    renderPromos();
}

for (const [sel, key] of Object.entries(storeFields)) {
    $(sel).addEventListener('input', (e) => {
        app.store[key] = e.target.value;
        updatePublishBar();
    });
}

function renderPromos() {
    const promos = app.store.promo_codes || [];
    $('#promo-list').innerHTML = promos.length ? promos.map((p, i) => `
        <div class="promo-row" data-i="${i}">
            <label>الكود <input data-k="code" value="${escapeHTML(p.code)}" dir="ltr"></label>
            <label>النوع
                <select data-k="type">
                    <option value="percentage" ${p.type === 'percentage' ? 'selected' : ''}>نسبة %</option>
                    <option value="fixed" ${p.type !== 'percentage' ? 'selected' : ''}>مبلغ ثابت</option>
                </select>
            </label>
            <label>القيمة <input data-k="value" type="number" min="0" value="${escapeHTML(p.value)}" dir="ltr"></label>
            <label>أقل طلب (جنيه) <input data-k="min_order" type="number" min="0" value="${escapeHTML(p.min_order ?? 0)}" dir="ltr"></label>
            <button class="btn btn-danger btn-sm" data-act="remove-promo">مسح</button>
        </div>`).join('') : '<p class="muted">مفيش أكواد خصم.</p>';
}

$('#promo-list').addEventListener('input', (e) => {
    const row = e.target.closest('.promo-row');
    if (!row || !e.target.dataset.k) return;
    const promo = app.store.promo_codes[Number(row.dataset.i)];
    const k = e.target.dataset.k;
    promo[k] = (k === 'value' || k === 'min_order') ? Number(e.target.value) || 0
        : k === 'code' ? e.target.value.trim().toUpperCase() : e.target.value;
    updatePublishBar();
});

$('#promo-list').addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="remove-promo"]')) return;
    const i = Number(e.target.closest('.promo-row').dataset.i);
    app.store.promo_codes.splice(i, 1);
    renderPromos();
    updatePublishBar();
});

$('#add-promo-btn').addEventListener('click', () => {
    app.store.promo_codes = app.store.promo_codes || [];
    app.store.promo_codes.push({ code: '', type: 'percentage', value: 10, min_order: 0 });
    renderPromos();
    updatePublishBar();
    $('#promo-list .promo-row:last-child input').focus();
});

// ---------- start ----------
(async function start() {
    const saved = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null');
    if (!saved || !saved.token) return showLogin();
    try {
        await connect(saved);
        showApp();
    } catch (err) {
        showLogin(friendlyError(err));
    }
})();
