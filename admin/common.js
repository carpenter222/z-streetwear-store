// ====================================================================
// Shared helpers for the admin page and the one-time setup page.
// ====================================================================

// The GitHub key is stored in this file, locked with the admin username + password.
const ACCESS_PATH = 'admin/access.json';
const PBKDF2_ITERATIONS = 600000;

// ---------- base64 ----------
function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}
const base64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
const textToBase64 = (text) => bytesToBase64(new TextEncoder().encode(text));
const base64ToText = (b64) => new TextDecoder().decode(base64ToBytes(b64));

// ---------- GitHub API ----------
async function ghRequest(creds, path, options = {}) {
    const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}${path}`, {
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${creds.token}`,
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

// Checks the key works and can write to the repo. Returns the default branch.
async function checkRepoAccess(creds) {
    const info = await ghRequest(creds, '');
    if (info.permissions && !info.permissions.push) {
        const err = new Error('no push'); err.status = 403; throw err;
    }
    return info.default_branch || 'main';
}

function friendlyError(err) {
    if (err.status === 401) return 'مفتاح GitHub غلط أو انتهت صلاحيته.';
    if (err.status === 403) return 'مفتاح GitHub مش معاه صلاحية تعديل. لازم Contents = Read and write.';
    if (err.status === 404) return 'مش لاقي الـ repository أو الملف. اتأكد من اسم الحساب واسم الـ repository، وإن المفتاح مسموح له بيه.';
    if (err.status === 409 || err.status === 422) return 'الملف اتغيّر من مكان تاني. اعمل تحديث للصفحة (Refresh) وجرّب تاني.';
    if (err instanceof TypeError) return 'مفيش إنترنت أو GitHub مش بيرد. جرّب تاني.';
    return `حصلت مشكلة: ${err.message}`;
}

function guessRepoFromURL() {
    // On GitHub Pages the address is https://OWNER.github.io/REPO/admin/
    const host = location.hostname;
    if (!host.endsWith('.github.io')) return {};
    const owner = host.replace('.github.io', '');
    const first = location.pathname.split('/').filter(Boolean)[0];
    const repo = first && first !== 'admin' ? first : host;
    return { owner, repo };
}

// ---------- locking the key with username + password ----------
async function deriveKey(username, password, salt, iterations) {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(`${username.trim().toLowerCase()}\n${password}`),
        'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

async function lockAccess({ owner, repo, token }, username, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(username, password, salt, PBKDF2_ITERATIONS);
    const secret = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify({ token })));
    return {
        version: 1,
        owner,
        repo,
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        data: bytesToBase64(new Uint8Array(secret))
    };
}

// Returns { owner, repo, token }, or null if the username/password is wrong.
async function unlockAccess(access, username, password) {
    try {
        const key = await deriveKey(username, password, base64ToBytes(access.salt), access.iterations);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(access.iv) }, key, base64ToBytes(access.data));
        const { token } = JSON.parse(new TextDecoder().decode(plain));
        return { owner: access.owner, repo: access.repo, token };
    } catch {
        return null;
    }
}

// Reads admin/access.json from the published site (it sits next to this page).
async function loadAccessFile() {
    const res = await fetch(`access.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json().catch(() => null);
}
