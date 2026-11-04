// One-time setup: locks the GitHub key with a username + password and
// saves it as admin/access.json in the repo, so the admin page only needs
// a username and password.

const $ = (s) => document.querySelector(s);

const guess = guessRepoFromURL();
$('#s-owner').value = guess.owner || '';
$('#s-repo').value = guess.repo || '';

$('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#setup-error');
    const btn = $('#setup-btn');
    err.textContent = '';

    const creds = {
        owner: $('#s-owner').value.trim(),
        repo: $('#s-repo').value.trim(),
        token: $('#s-token').value.trim()
    };
    const username = $('#s-user').value.trim();
    const password = $('#s-pass').value;

    if (password !== $('#s-pass2').value) { err.textContent = 'كلمتين السر مش زي بعض.'; return; }
    if (password.length < 10) { err.textContent = 'كلمة السر لازم تكون ١٠ حروف أو أكتر.'; return; }

    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';
    try {
        const branch = await checkRepoAccess(creds);
        const access = await lockAccess(creds, username, password);

        // Replace the old file if setup was done before.
        let sha;
        try {
            sha = (await ghRequest(creds, `/contents/${ACCESS_PATH}?ref=${encodeURIComponent(branch)}`)).sha;
        } catch (e2) {
            if (e2.status !== 404) throw e2;
        }

        await ghRequest(creds, `/contents/${ACCESS_PATH}`, {
            method: 'PUT',
            body: JSON.stringify({
                message: 'إعداد دخول لوحة الإدارة',
                content: textToBase64(JSON.stringify(access, null, 2) + '\n'),
                branch,
                ...(sha ? { sha } : {})
            })
        });

        $('#setup-form').hidden = true;
        $('#setup-done').hidden = false;
        const link = $('#admin-link');
        link.href = './';
        link.textContent = new URL('./', location.href).href;
    } catch (e2) {
        err.textContent = friendlyError(e2);
    } finally {
        btn.disabled = false;
        btn.textContent = 'حفظ الإعداد';
        $('#s-token').value = '';
    }
});
