/* ═══════════════════════════════════════════════════════════════════════
   script.js — TikTok scraper, map, share, scroll, JSON import,
   avatar preview, name analysis (Genderize, Nationalize, Agify)
   No emoji – only Font Awesome + flag-icons
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── DOM References ──────────────────
    const scrapeForm       = document.getElementById('scrapeForm');
    const usernameInput    = document.getElementById('usernameInput');
    const scrapeBtn        = document.getElementById('scrapeBtn');
    const statusMessage    = document.getElementById('statusMessage');
    const mainCard         = document.getElementById('mainCard');
    const resultsContainer = document.getElementById('resultsContainer');
    const avatarImg        = document.getElementById('avatarImg');
    const avatarContainer  = document.getElementById('avatarContainer');
    const verifiedBadge    = document.getElementById('verifiedBadge');
    const displayNameEl    = document.getElementById('displayName');
    const usernameHandle   = document.getElementById('usernameHandle');
    const bioText          = document.getElementById('bioText');
    const bioLink          = document.getElementById('bioLink');
    const badgeRow         = document.getElementById('badgeRow');
    const statsGrid        = document.getElementById('statsGrid');
    const detailGrid       = document.getElementById('detailGrid');
    const btnDownload      = document.getElementById('btnDownload');
    const btnShare         = document.getElementById('btnShare');
    const btnImport        = document.getElementById('btnImport');
    const btnImportAlways  = document.getElementById('btnImportAlways');
    const importFileInput  = document.getElementById('importFileInput');
    const themeToggleBtn   = document.getElementById('themeToggle');
    const mapWrapper       = document.getElementById('mapWrapper');
    const mapCountryLabel  = document.getElementById('mapCountryLabel');
    const scrollToggleBtn  = document.getElementById('scrollToggleBtn');

    // Name Analysis
    const nameAnalysisSection = document.getElementById('nameAnalysisSection');
    const genderContent       = document.getElementById('genderContent');
    const ageContent          = document.getElementById('ageContent');
    const nationalityContent  = document.getElementById('nationalityContent');

    // Avatar preview modal
    const avatarModalOverlay   = document.getElementById('avatarModalOverlay');
    const avatarModalCloseBtn  = document.getElementById('avatarModalClose');
    const avatarModalImg       = document.getElementById('avatarModalImg');
    const avatarModalDownload  = document.getElementById('avatarModalDownload');

    // ── State ───────────────────────────
    let currentScrapedData = null;
    let currentAvatarURL   = null;
    let currentUsername    = null;
    let countriesData      = [];
    let languagesData      = [];
    let svgDoc             = null;
    let svgRootElement     = null;
    let svgReadyPromise    = null;

    // ── CORS Proxies ───────────────────
    const CORS_PROXIES = [
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ];

    // ═══════════════════════════════════════════
    //  DATA LOADING
    // ═══════════════════════════════════════════

    async function loadJSON(path) {
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`Failed to load ${path} (HTTP ${resp.status})`);
        return resp.json();
    }

    async function loadSVGMap(path) {
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`Failed to load ${path} (HTTP ${resp.status})`);
        const text = await resp.text();
        const parser = new DOMParser();
        return parser.parseFromString(text, 'image/svg+xml');
    }

    svgReadyPromise = (async function initData() {
        try {
            [countriesData, languagesData] = await Promise.all([
                loadJSON('countries.json'),
                loadJSON('languages.json'),
            ]);
        } catch (e) {
            console.warn('Could not load countries.json or languages.json — using embedded fallbacks.', e);
        }
        try {
            svgDoc = await loadSVGMap('world.svg');
            console.log('✅ World map SVG loaded successfully.');
        } catch (e) {
            console.warn('Could not load world.svg. Map feature will be unavailable.', e);
        }
    })();

    // ═══════════════════════════════════════════
    //  LOOKUP HELPERS
    // ═══════════════════════════════════════════

    function getCountryByCode(code) {
        if (!code || !countriesData.length) return null;
        const upper = code.toUpperCase();
        return countriesData.find(c => c.code.toUpperCase() === upper) || null;
    }

    function getLanguageByCode(code) {
        if (!code || !languagesData.length) return null;
        const lower = code.toLowerCase();
        return languagesData.find(l => l.code.toLowerCase() === lower) || null;
    }

    // ═══════════════════════════════════════════
    //  THEME
    // ═══════════════════════════════════════════

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = themeToggleBtn.querySelector('i');
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        localStorage.setItem('tiktok-scraper-theme', theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    const savedTheme = localStorage.getItem('tiktok-scraper-theme') || 'light';
    setTheme(savedTheme);
    themeToggleBtn.addEventListener('click', toggleTheme);

    // ═══════════════════════════════════════════
    //  SCROLL TOGGLE
    // ═══════════════════════════════════════════

    function updateScrollButtonVisibility() {
        const scrollY = window.scrollY || window.pageYOffset;
        const threshold = 300;
        if (scrollY > threshold) {
            scrollToggleBtn.classList.add('visible');
        } else {
            scrollToggleBtn.classList.remove('visible');
        }
        const nearBottom = window.innerHeight + scrollY >= document.body.scrollHeight - 100;
        const icon = scrollToggleBtn.querySelector('i');
        icon.className = nearBottom ? 'fa-solid fa-angles-up' : 'fa-solid fa-angles-down';
    }

    function toggleScroll() {
        const scrollY = window.scrollY || window.pageYOffset;
        const nearBottom = window.innerHeight + scrollY >= document.body.scrollHeight - 100;
        window.scrollTo({ top: nearBottom ? 0 : document.body.scrollHeight, behavior: 'smooth' });
    }

    window.addEventListener('scroll', updateScrollButtonVisibility, { passive: true });
    scrollToggleBtn.addEventListener('click', toggleScroll);

    // ═══════════════════════════════════════════
    //  UTILITY FUNCTIONS
    // ═══════════════════════════════════════════

    function sanitizeUsername(input) {
        let cleaned = input.trim();
        if (cleaned.startsWith('@')) cleaned = cleaned.substring(1);
        if (cleaned.includes('tiktok.com/')) {
            const match = cleaned.match(/tiktok\.com\/@?([^/?\s]+)/i);
            if (match) cleaned = match[1];
        }
        return cleaned.split('/')[0].split('?')[0].split('#')[0].trim();
    }

    function formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        const n = parseInt(num, 10);
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
        return n.toLocaleString();
    }

    function formatUnixTimestamp(ts) {
        if (!ts || ts === 0) return 'Unknown';
        return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showStatus(type, message) {
        statusMessage.className = 'status-message ' + type;
        statusMessage.innerHTML = message;
        statusMessage.style.display = 'flex';
    }

    function hideStatus() {
        statusMessage.className = 'status-message';
        statusMessage.innerHTML = '';
        statusMessage.style.display = 'none';
    }

    function setLoading(isLoading) {
        if (isLoading) {
            scrapeBtn.classList.add('loading');
            scrapeBtn.disabled = true;
            usernameInput.disabled = true;
        } else {
            scrapeBtn.classList.remove('loading');
            scrapeBtn.disabled = false;
            usernameInput.disabled = false;
        }
    }

    function showResults() {
        resultsContainer.classList.add('visible');
        mainCard.classList.add('has-results');
        setTimeout(() => resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    function hideResults() {
        resultsContainer.classList.remove('visible');
        mainCard.classList.remove('has-results');
        currentScrapedData = null;
        currentAvatarURL = null;
        currentUsername = null;
        if (nameAnalysisSection) nameAnalysisSection.style.display = 'none';
        if (mapWrapper && svgRootElement) {
            const prev = mapWrapper.querySelectorAll('path.highlighted');
            prev.forEach(p => p.classList.remove('highlighted'));
            if (svgRootElement._originalViewBox) {
                svgRootElement.setAttribute('viewBox', svgRootElement._originalViewBox);
            }
        }
    }

    // ═══════════════════════════════════════════
    //  SCRAPING
    // ═══════════════════════════════════════════

    function extractUserDataFromHTML(html) {
        const scriptRegex = /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i;
        const match = html.match(scriptRegex) ||
                      html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i);
        if (!match || !match[1]) throw new Error('Could not find profile data script tag.');
        return parseJSONData(match[1]);
    }

    function parseJSONData(jsonString) {
        let data;
        try { data = JSON.parse(jsonString); } catch (e) { throw new Error('Failed to parse profile JSON.'); }
        const defaultScope = data.__DEFAULT_SCOPE__;
        if (!defaultScope) throw new Error('Missing __DEFAULT_SCOPE__');
        const userDetail = defaultScope['webapp.user-detail'];
        if (!userDetail?.userInfo) throw new Error('Missing user detail data.');
        const user  = userDetail.userInfo.user  || {};
        const stats = userDetail.userInfo.stats || {};
        if (!user || Object.keys(user).length === 0) throw new Error('No user data found.');
        return { user, stats };
    }

    async function fetchTikTokPage(username) {
        const tiktokURL = `https://www.tiktok.com/@${username}?isUniqueId=true&isSecured=true`;
        let lastError = null;
        for (let i = 0; i < CORS_PROXIES.length; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 18000);
                const response = await fetch(CORS_PROXIES[i](tiktokURL), {
                    signal: controller.signal,
                    headers: { 'Accept': 'text/html,application/xhtml+xml' },
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const html = await response.text();
                if (html.length < 500 ||
                    (!html.includes('__UNIVERSAL_DATA_FOR_REHYDRATION__') &&
                     !html.includes('webapp.user-detail'))) {
                    throw new Error('Response does not contain expected TikTok data.');
                }
                return html;
            } catch (err) {
                lastError = err.name === 'AbortError' ? new Error('Request timed out.') : err;
                continue;
            }
        }
        throw lastError || new Error('All proxy attempts failed.');
    }

    // ═══════════════════════════════════════════
    //  DOWNLOADS & SHARE
    // ═══════════════════════════════════════════

    async function downloadAvatar(imageURL) {
        if (!imageURL) return;
        try {
            const response = await fetch(imageURL);
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = blob.type.split('/')[1] || 'jpg';
            a.download = `tiktok_avatar_${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            window.open(imageURL, '_blank');
        }
    }

    function downloadJSON(data) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const username = data.user?.uniqueId || 'tiktok_user';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `tiktok_${username}_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function copyShareLink() {
        if (!currentUsername) {
            showStatus('warning', '<i class="fa-solid fa-triangle-exclamation"></i> <span>No user scraped yet.</span>');
            return;
        }
        const url = new URL(window.location);
        url.hash = currentUsername;
        const shareUrl = url.toString();
        navigator.clipboard.writeText(shareUrl).then(() => {
            btnShare.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            btnShare.disabled = true;
            setTimeout(() => {
                btnShare.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share Link';
                btnShare.disabled = false;
            }, 2000);
        }).catch(() => {
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            btnShare.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            btnShare.disabled = true;
            setTimeout(() => {
                btnShare.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share Link';
                btnShare.disabled = false;
            }, 2000);
        });
    }

    // ═══════════════════════════════════════════
    //  JSON IMPORT
    // ═══════════════════════════════════════════

    function importJSONFromFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                const user = data.user || data;
                const stats = data.stats || {};
                if (!user.uniqueId && !user.id) {
                    throw new Error('Invalid JSON structure – missing user id/uniqueId.');
                }
                renderFromImportedData(user, stats);
                showStatus('info', '<i class="fa-solid fa-circle-check"></i> <span>User data imported successfully.</span>');
            } catch (err) {
                showStatus('error', `<i class="fa-solid fa-triangle-exclamation"></i> <span>Failed to import JSON: ${escapeHTML(err.message)}</span>`);
            }
        };
        reader.onerror = function () {
            showStatus('error', '<i class="fa-solid fa-triangle-exclamation"></i> <span>Could not read file.</span>');
        };
        reader.readAsText(file);
    }

    function renderFromImportedData(user, stats) {
        const region = user.region || user.regionCode || '';
        const language = user.language || '';
        const avatarURL = user.avatarLarger || user.avatarMedium || user.avatarThumb || '';

        const fullUser = {
            id: user.id || '',
            uniqueId: user.uniqueId || '',
            nickname: user.nickname || '',
            avatarLarger: avatarURL,
            signature: user.signature || '',
            createTime: user.createTime || 0,
            verified: user.verified || false,
            secUid: user.secUid || '',
            privateAccount: user.privateAccount || false,
            secret: user.secret || false,
            region: region,
            language: language,
            nickNameModifyTime: user.nickNameModifyTime || 0,
            bioLink: user.bioLink || null,
        };

        const fullStats = {
            followerCount:  stats.followerCount  || 0,
            followingCount: stats.followingCount || 0,
            heartCount:     stats.heartCount || stats.heart || 0,
            videoCount:     stats.videoCount     || 0,
            diggCount:      stats.diggCount      || 0,
            friendCount:    stats.friendCount    || 0,
        };

        renderResults(fullUser, fullStats);
    }

    // ═══════════════════════════════════════════
    //  AVATAR PREVIEW POPUP
    // ═══════════════════════════════════════════

    function openAvatarPreview() {
        if (!currentAvatarURL) return;
        avatarModalImg.src = currentAvatarURL;
        avatarModalDownload.href = currentAvatarURL;
        avatarModalDownload.setAttribute('download', `tiktok_avatar_${currentUsername || Date.now()}.jpg`);
        avatarModalOverlay.classList.add('visible');
    }

    function closeAvatarPreview() {
        avatarModalOverlay.classList.remove('visible');
    }

    avatarContainer.addEventListener('click', openAvatarPreview);
    avatarModalCloseBtn.addEventListener('click', closeAvatarPreview);
    avatarModalOverlay.addEventListener('click', (e) => {
        if (e.target === avatarModalOverlay) closeAvatarPreview();
    });

    // ═══════════════════════════════════════════
    //  NAME ANALYSIS (Genderize, Nationalize, Agify)
    // ═══════════════════════════════════════════

    function extractFirstName(nickname) {
        if (!nickname) return null;
        const cleaned = nickname.replace(/[^a-zA-Z\s]/g, ' ').trim();
        const parts = cleaned.split(/\s+/);
        const first = parts[0];
        if (first && first.length >= 2) return first;
        return parts.length > 1 && parts[1].length >= 2 ? parts[1] : null;
    }

    function flagIcon(code) {
        return `<span class="fi fi-${code.toLowerCase()}"></span>`;
    }

    async function analyzeName(nickname) {
        const firstName = extractFirstName(nickname);
        if (!firstName) {
            if (nameAnalysisSection) nameAnalysisSection.style.display = 'none';
            return;
        }

        if (nameAnalysisSection) nameAnalysisSection.style.display = '';
        if (genderContent) genderContent.innerHTML = '<span class="loading-text">Analyzing...</span>';
        if (ageContent) ageContent.innerHTML = '<span class="loading-text">Analyzing...</span>';
        if (nationalityContent) nationalityContent.innerHTML = '<span class="loading-text">Analyzing...</span>';

        const encodedName = encodeURIComponent(firstName);

        const results = await Promise.allSettled([
            fetch(`https://api.genderize.io?name=${encodedName}`).then(r => r.json()),
            fetch(`https://api.agify.io?name=${encodedName}`).then(r => r.json()),
            fetch(`https://api.nationalize.io?name=${encodedName}`).then(r => r.json())
        ]);

        // Gender
        if (results[0].status === 'fulfilled' && results[0].value.gender) {
            const g = results[0].value;
            const pct = Math.round(g.probability * 100);
            const icon = g.gender === 'male' ? '<i class="fa-solid fa-mars"></i>' : '<i class="fa-solid fa-venus"></i>';
            if (genderContent) genderContent.innerHTML = `<span class="highlight">${icon} ${g.gender}</span><span class="sub">${pct}% probability</span>`;
        } else {
            if (genderContent) genderContent.innerHTML = '<span class="error-text">Unable to determine</span>';
        }

        // Age
        if (results[1].status === 'fulfilled' && results[1].value.age) {
            const a = results[1].value;
            if (ageContent) ageContent.innerHTML = `<span class="highlight">${a.age} years</span><span class="sub">predicted age</span>`;
        } else {
            if (ageContent) ageContent.innerHTML = '<span class="error-text">Unable to determine</span>';
        }

        // Nationality
        if (results[2].status === 'fulfilled' && results[2].value.country?.length) {
            const top = results[2].value.country[0];
            const country = getCountryByCode(top.country_id);
            const pct = Math.round(top.probability * 100);
            const display = country
                ? `${flagIcon(top.country_id)} ${escapeHTML(country.name)}`
                : top.country_id;
            if (nationalityContent) nationalityContent.innerHTML = `<span class="highlight">${display}</span><span class="sub">${pct}% probability</span>`;
        } else {
            if (nationalityContent) nationalityContent.innerHTML = '<span class="error-text">Unable to determine</span>';
        }
    }

    // ═══════════════════════════════════════════
    //  SVG MAP
    // ═══════════════════════════════════════════

    function injectSVGMap() {
        if (!svgDoc || !mapWrapper) return;
        const svgRoot = svgDoc.documentElement;
        if (!svgRoot) return;
        const clone = svgRoot.cloneNode(true);
        mapWrapper.innerHTML = '';
        mapWrapper.appendChild(clone);
        svgRootElement = clone;
        const origViewBox = svgRootElement.getAttribute('viewBox');
        svgRootElement._originalViewBox = origViewBox;
        const paths = svgRootElement.querySelectorAll('path[id]');
        paths.forEach(path => {
            const id = path.getAttribute('id');
            if (id && id.length === 2) {
                const upper = id.toUpperCase();
                const country = getCountryByCode(upper);
                if (country) {
                    path.setAttribute('data-country', country.name);
                    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                    titleEl.textContent = country.name;
                    path.insertBefore(titleEl, path.firstChild);
                }
            }
        });
        console.log('✅ SVG map injected.');
    }

    async function highlightAndZoomToCountry(regionCode) {
        if (!regionCode || !svgRootElement || !mapWrapper) return;
        await svgReadyPromise;
        if (!svgDoc || !svgRootElement) {
            if (mapCountryLabel) {
                mapCountryLabel.textContent = 'Map unavailable';
                mapCountryLabel.style.display = '';
            }
            return;
        }
        const allPaths = mapWrapper.querySelectorAll('path');
        allPaths.forEach(p => p.classList.remove('highlighted'));
        const lowerCode = regionCode.toLowerCase();
        let targetPath = svgRootElement.getElementById(lowerCode);
        if (!targetPath) {
            for (const path of svgRootElement.querySelectorAll('path')) {
                if (path.getAttribute('id')?.toLowerCase() === lowerCode) {
                    targetPath = path;
                    break;
                }
            }
        }
        if (!targetPath) targetPath = svgRootElement.querySelector(`.${lowerCode}`);
        const country = getCountryByCode(regionCode);
        if (targetPath) {
            targetPath.classList.add('highlighted');
            if (mapCountryLabel) {
                mapCountryLabel.innerHTML = country
                    ? `${flagIcon(regionCode)} ${escapeHTML(country.name)}`
                    : regionCode;
                mapCountryLabel.style.display = '';
            }
            try {
                const bbox = targetPath.getBBox();
                const padding = 20;
                const newViewBox = [bbox.x - padding, bbox.y - padding, bbox.width + padding * 2, bbox.height + padding * 2].join(' ');
                svgRootElement.style.transition = 'viewBox 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)';
                svgRootElement.setAttribute('viewBox', newViewBox);
                svgRootElement.addEventListener('transitionend', function handler() {
                    svgRootElement.style.transition = '';
                    svgRootElement.removeEventListener('transitionend', handler);
                }, { once: true });
            } catch (e) { console.warn('Could not getBBox – zoom skipped.', e); }
            const mapCard = document.getElementById('mapCard');
            if (mapCard) setTimeout(() => mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
        } else {
            if (mapCountryLabel) {
                mapCountryLabel.innerHTML = country
                    ? `${flagIcon(regionCode)} ${escapeHTML(country.name)} (not on map)`
                    : `${regionCode} (not on map)`;
                mapCountryLabel.style.display = '';
            }
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    function renderResults(user, stats) {
        const countryEntry = getCountryByCode(user.region);
        const languageEntry = getLanguageByCode(user.language);
        currentUsername = user.uniqueId || null;

        currentScrapedData = {
            scrapedAt: new Date().toISOString(),
            user: {
                id: user.id || null,
                uniqueId: user.uniqueId || null,
                nickname: user.nickname || null,
                avatarLarger: user.avatarLarger || null,
                signature: user.signature || null,
                createTime: user.createTime || null,
                verified: user.verified || false,
                secUid: user.secUid || null,
                privateAccount: user.privateAccount || false,
                secret: user.secret || false,
                region: user.region || null,
                regionName: countryEntry?.name || null,
                regionEmoji: countryEntry?.emoji || null,
                language: user.language || null,
                languageName: languageEntry?.name || null,
                nickNameModifyTime: user.nickNameModifyTime || null,
                bioLink: user.bioLink?.link || null,
            },
            stats: {
                followerCount:  stats.followerCount  || 0,
                followingCount: stats.followingCount || 0,
                heartCount:     stats.heartCount || stats.heart || 0,
                videoCount:     stats.videoCount     || 0,
                diggCount:      stats.diggCount      || 0,
                friendCount:    stats.friendCount    || 0,
            },
        };

        const avatarURL = user.avatarLarger || user.avatarMedium || user.avatarThumb || '';
        currentAvatarURL = avatarURL;
        if (avatarURL) {
            avatarImg.src = avatarURL;
            avatarImg.alt = user.nickname || user.uniqueId || 'User avatar';
            avatarImg.onerror = function () {
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23444" width="100" height="100"/><text x="50" y="55" text-anchor="middle" font-size="40" fill="%23fff">?</text></svg>';
            };
        } else {
            avatarImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23444" width="100" height="100"/><text x="50" y="55" text-anchor="middle" font-size="40" fill="%23fff">?</text></svg>';
            currentAvatarURL = null;
        }

        verifiedBadge.style.display = user.verified === true ? 'flex' : 'none';
        displayNameEl.textContent  = user.nickname || user.uniqueId || 'Unknown';
        if (user.uniqueId) {
            const profileUrl = `https://www.tiktok.com/@${user.uniqueId}`;
            usernameHandle.innerHTML = `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">@${escapeHTML(user.uniqueId)}</a>`;
        } else {
            usernameHandle.innerHTML = '@—';
        }

        const signature = user.signature || '';
        bioText.textContent = signature;
        bioText.style.display = signature ? '' : 'none';
        if (!signature) bioText.textContent = '';

        if (user.bioLink?.link) {
            bioLink.href = user.bioLink.link;
            bioLink.textContent = user.bioLink.link;
            bioLink.style.display = 'inline-block';
        } else {
            bioLink.style.display = 'none';
        }

        badgeRow.innerHTML = '';
        const badges = [];
        if (countryEntry) {
            badges.push({
                icon: 'fa-solid fa-globe',
                text: `${flagIcon(user.region)} ${escapeHTML(countryEntry.name)}`,
                cls: 'badge-region'
            });
        } else if (user.region) {
            badges.push({ icon:'fa-solid fa-globe', text:escapeHTML(user.region), cls:'badge-region' });
        }
        if (languageEntry) {
            badges.push({ icon:'fa-solid fa-language', text:escapeHTML(languageEntry.name), cls:'badge-language' });
        } else if (user.language) {
            badges.push({ icon:'fa-solid fa-language', text:escapeHTML(user.language.toUpperCase()), cls:'badge-language' });
        }
        if (user.verified === true) {
            badges.push({ icon:'fa-solid fa-circle-check', text:'Verified', cls:'badge-verified' });
        }
        badges.push(
            user.privateAccount
                ? { icon:'fa-solid fa-lock', text:'Private', cls:'badge-private' }
                : { icon:'fa-solid fa-earth-americas', text:'Public', cls:'badge-public' }
        );
        if (user.secret) {
            badges.push({ icon:'fa-solid fa-eye', text:'Secret', cls:'badge-secret' });
        }
        badges.forEach(b => {
            const span = document.createElement('span');
            span.className = 'badge ' + b.cls;
            span.innerHTML = `<i class="${b.icon}"></i> ${b.text}`;
            badgeRow.appendChild(span);
        });

        const statsData = [
            { icon:'fa-solid fa-users',     value:formatNumber(stats.followerCount),                label:'Followers' },
            { icon:'fa-solid fa-user',      value:formatNumber(stats.followingCount),               label:'Following' },
            { icon:'fa-solid fa-heart',     value:formatNumber(stats.heartCount||stats.heart),      label:'Hearts' },
            { icon:'fa-solid fa-video',     value:formatNumber(stats.videoCount),                   label:'Videos' },
            { icon:'fa-solid fa-thumbs-up', value:formatNumber(stats.diggCount),                    label:'Diggs' },
            { icon:'fa-solid fa-handshake', value:formatNumber(stats.friendCount),                  label:'Friends' },
        ];
        statsGrid.innerHTML = '';
        statsData.forEach(s => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `<i class="${s.icon} stat-icon"></i><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div>`;
            statsGrid.appendChild(card);
        });

        const details = [
            { icon:'fa-solid fa-id-card',         label:'User ID',        value:user.id||'N/A', mono:true },
            { icon:'fa-solid fa-at',               label:'Unique ID',      value:user.uniqueId||'N/A' },
            { icon:'fa-solid fa-signature',        label:'Nickname',       value:user.nickname||'N/A' },
            { icon:'fa-solid fa-location-dot',     label:'Region',         value:countryEntry ? `${flagIcon(user.region)} ${escapeHTML(countryEntry.name)}` : (user.region||'N/A') },
            { icon:'fa-solid fa-language',         label:'Language',       value:languageEntry ? languageEntry.name : (user.language||'N/A') },
            { icon:'fa-solid fa-calendar-plus',    label:'Created',        value:formatUnixTimestamp(user.createTime) },
            { icon:'fa-solid fa-calendar-check',   label:'Nick Modified',  value:formatUnixTimestamp(user.nickNameModifyTime) },
            { icon:'fa-solid fa-certificate',      label:'Verified',       value:user.verified ? '<i class="fa-solid fa-circle-check" style="color:var(--accent);"></i> Yes' : 'No' },
            { icon:'fa-solid fa-shield-halved',    label:'Private',        value:user.privateAccount ? '<i class="fa-solid fa-lock" style="color:var(--accent);"></i> Yes' : 'No' },
            { icon:'fa-solid fa-mask',             label:'Secret',         value:user.secret ? '<i class="fa-solid fa-eye" style="color:var(--accent);"></i> Yes' : 'No' },
            { icon:'fa-solid fa-fingerprint',      label:'secUid',         value:user.secUid||'N/A', mono:true },
        ];
        detailGrid.innerHTML = '';
        details.forEach(d => {
            const item = document.createElement('div');
            item.className = 'detail-item';
            const valClass = d.mono ? 'detail-value mono' : 'detail-value';
            item.innerHTML = `<i class="${d.icon} detail-icon"></i><div class="detail-content"><span class="detail-label">${d.label}</span><span class="${valClass}">${d.value}</span></div>`;
            detailGrid.appendChild(item);
        });

        if (svgDoc && (!svgRootElement || mapWrapper.children.length === 0)) injectSVGMap();
        if (user.region) highlightAndZoomToCountry(user.region);
        showResults();

        // Trigger name analysis
        analyzeName(user.nickname);
    }

    // ═══════════════════════════════════════════
    //  MAIN SCRAPE HANDLER
    // ═══════════════════════════════════════════

    async function handleScrape(username) {
        hideStatus();
        hideResults();
        setLoading(true);
        try {
            const html = await fetchTikTokPage(username);
            const { user, stats } = extractUserDataFromHTML(html);
            renderResults(user, stats);
            hideStatus();
        } catch (err) {
            hideResults();
            let msg = err.message || 'Unknown error.';
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) msg = 'Network error. Check connection.';
            else if (msg.includes('timed out')) msg = 'Request timed out. Try again.';
            else if (msg.includes('HTTP 4') || msg.includes('HTTP 5')) msg = 'Proxy error. TikTok may be rate-limiting.';
            showStatus('error', `<i class="fa-solid fa-triangle-exclamation"></i> <span>${escapeHTML(msg)}</span>`);
        } finally { setLoading(false); }
    }

    // ═══════════════════════════════════════════
    //  EVENT LISTENERS
    // ═══════════════════════════════════════════

    scrapeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const username = sanitizeUsername(usernameInput.value);
        if (!username) {
            showStatus('warning', '<i class="fa-solid fa-triangle-exclamation"></i> <span>Please enter a valid username.</span>');
            usernameInput.focus();
            return;
        }
        usernameInput.value = username;
        usernameInput.classList.add('has-value');
        handleScrape(username);
    });

    usernameInput.addEventListener('input', function () {
        this.classList.toggle('has-value', !!this.value.trim());
        if (statusMessage.style.display !== 'none') hideStatus();
    });

    usernameInput.addEventListener('paste', function (e) {
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        if (pasted && pasted.includes('tiktok.com/')) {
            e.preventDefault();
            const cleaned = sanitizeUsername(pasted);
            this.value = cleaned;
            this.classList.add('has-value');
        }
    });

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement === usernameInput) {
            scrapeForm.dispatchEvent(new Event('submit'));
        }
    });

    btnDownload.addEventListener('click', () => { if (currentScrapedData) downloadJSON(currentScrapedData); });
    btnShare.addEventListener('click', copyShareLink);

    function triggerImport() { importFileInput.click(); }
    btnImport.addEventListener('click', triggerImport);
    btnImportAlways.addEventListener('click', triggerImport);

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { importJSONFromFile(file); }
        importFileInput.value = '';
    });

    // ═══════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════

    usernameInput.focus();
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
        const hashUser = sanitizeUsername(hash.substring(1));
        if (hashUser) {
            usernameInput.value = hashUser;
            usernameInput.classList.add('has-value');
            setTimeout(() => handleScrape(hashUser), 800);
        }
    }
})();
