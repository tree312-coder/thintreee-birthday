"use strict";
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastRegion = document.getElementById('toast-region');
let session = { authenticated: false, role: null, slug: null };
let publicData = null;
let currentSection = null;
let adminData = null;
let adminTab = 'overview';
let adminGroup = 'family';
let revealOpen = false;
let music = null;
let musicTrack = '';
let volume = .34;
let playing = false;
let countdownTimer;
let renderSerial = 0;
const config = {
    family: { chapter: 'CHAPTER 01', name: 'Family', title: 'A Letter of Love', description: 'To the ones who feel like home, in every universe.', mode: 'family', sign: 'A LETTER SEALED WITH LOVE', symbol: '♡' },
    'high-school': { chapter: 'CHAPTER 02', name: 'High School', title: 'The Days We Keep', description: 'The beautiful, unrepeatable days of being us.', mode: 'school', sign: 'NOTES FROM THE GOOD OLD DAYS', symbol: '✎' },
    university: { chapter: 'CHAPTER 03', name: 'University Friend', title: "The Fool’s Journey", description: 'New beginnings, cosmic accidents, lifelong people.', mode: 'university', sign: 'THE STARS HAVE MORE TO TELL', symbol: '☽' }
};
const hobbies = [
    { icon: '♧', tag: '01 / IN MOTION', title: 'Sports', items: ['Cầu lông', 'Pickleball', 'Bóng bàn'] },
    { icon: '✧', tag: '02 / PLAYFUL DAYS', title: 'Entertainment', items: ['Bowling', 'Gaming'] },
    { icon: '✦', tag: '03 / DIGITAL UNIVERSES', title: 'Favorite games', items: ['Reverse: 1999', 'Genshin Impact', 'Honkai: Star Rail', 'Roblox', 'Identity V'] },
    { icon: '▣', tag: '04 / ON THE SCREEN', title: 'Cinema', items: ['Thích xem phim hay', 'Có hứng thú với làm phim'] },
    { icon: '♫', tag: '05 / LISTEN CLOSELY', title: 'Music', items: ['Nhạc ngoại', 'Ballad', 'Vọng cổ', 'Dân ca kết hợp hiện đại', 'Nhạc truyền thống', 'Pop', 'Có thể hát nhiều thể loại nhạc'] }
];
function esc(x) { return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)); }
function time(when) { return new Date(when).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' }); }
function slugIs(s) { return s === 'family' || s === 'high-school' || s === 'university'; }
function dataRoute(s) { return `/collection/${s}`; }
function portalRoute(s) { return `/portal/${s}`; }
function canEnter(s) { return session.role === 'admin' || (session.authenticated && session.slug === s); }
function toast(message, kind = 'good') {
    const t = document.createElement('div');
    t.className = `toast toast--${kind}`;
    t.textContent = message;
    toastRegion.appendChild(t);
    window.setTimeout(() => { t.classList.add('toast-leaving'); window.setTimeout(() => t.remove(), 450); }, 4300);
}
async function api(url, opts = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opts });
    let data;
    try {
        data = await response.json();
    }
    catch {
        throw Error('Máy chủ không phản hồi đúng định dạng.');
    }
    if (!response.ok)
        throw Error(data.error || `HTTP ${response.status}`);
    return data;
}
function jsonOpts(method, data) { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }; }
function navigate(url, replace = false) {
    if (replace)
        history.replaceState({}, '', url);
    else
        history.pushState({}, '', url);
    revealOpen = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    void renderRoute();
}
function stopMusic() { if (music) {
    music.pause();
    music.src = '';
    music = null;
} playing = false; musicTrack = ''; }
function syncMusic(track) {
    const active = track || '/audio/intro.wav';
    if (active === musicTrack && music)
        return;
    stopMusic();
    musicTrack = active;
    music = new Audio(active);
    music.loop = true;
    music.volume = volume;
    music.preload = 'none';
}
function header(theme = 'home') {
    const canLogout = session.authenticated;
    const musicControls = `<div class="player" aria-label="Music player"><button class="music-toggle" data-action="music" aria-label="${playing ? 'Tắt nhạc' : 'Bật nhạc'}" title="${playing ? 'Pause' : 'Play'} music">${playing ? '❚❚' : '♫'} <span>${playing ? 'PAUSE' : 'MUSIC'}</span></button><label class="volume-wrap" title="Âm lượng"><span>◔</span><input id="music-volume" type="range" min="0" max="100" value="${Math.round(volume * 100)}" aria-label="Âm lượng"></label></div>`;
    return `<header class="site-header site-header--${theme}"><a href="/" class="wordmark" data-link aria-label="ThinTreé Home">ThinTreé<span class="brand-dot">.</span></a>
    <span class="header-issue">A PERSONAL BIRTHDAY COLLECTION <span class="header-star">✳</span> EST. 2007</span>
    <nav class="header-nav" aria-label="Điều hướng chính"><button class="nav-link back-link" data-action="back" title="Go back">← <span>Back</span></button><a class="nav-link" href="/" data-link>Home</a>
    <a class="nav-link nav-about" href="/about" data-link>About</a>${canLogout ? `<button class="nav-link" data-action="logout">Logout</button>` : ''}${musicControls}</nav></header>`;
}
function footer(theme = 'home') { return `<footer class="footer footer--${theme}"><span class="wordmark footer-brand">ThinTreé<span class="brand-dot">.</span></span><span>Made of memories, made with love.</span><span>© ${new Date().getFullYear()} · FOR THIÊN TRÍ ✳</span></footer>`; }
function shell(content, theme = 'home') { app.className = `app-shell theme-${theme}`; app.innerHTML = `${header(theme)}<main id="main-content">${content}</main>${footer(theme)}`; requestAnimationFrame(() => document.querySelectorAll('.animate-in').forEach(el => el.classList.add('is-visible'))); }
function loader() { app.className = 'app-loading'; app.innerHTML = `<div class="initial-loader"><span class="loader-orbit"></span><span class="wordmark">ThinTreé<span class="brand-dot">.</span></span><span class="eyebrow">OPENING A LITTLE UNIVERSE</span></div>`; }
function sectionDivider(n, label) { return `<div class="section-number"><span>${esc(n)}</span><span class="hairline"></span><span>${esc(label)}</span></div>`; }
function revealTitle(text) { return `<span class="eyebrow">${esc(text)}</span>`; }
function introStars() { return `<div class="hero-sparks" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✳</i><i>✧</i><i>✦</i></div>`; }
function countdown() { return `<div class="countdown" aria-label="Đếm ngược đến sinh nhật"><div><strong id="cd-days">--</strong><small>DAYS</small></div><span>:</span><div><strong id="cd-hours">--</strong><small>HOURS</small></div><span>:</span><div><strong id="cd-minutes">--</strong><small>MINS</small></div><span>:</span><div><strong id="cd-seconds">--</strong><small>SECS</small></div></div>`; }
function startCountdown() {
    if (countdownTimer)
        clearInterval(countdownTimer);
    function tick() {
        if (!document.getElementById('cd-days'))
            return;
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(now));
        let target = Date.UTC(year, 11, 2, 17, 0, 0);
        if (now.getTime() >= target)
            target = Date.UTC(year + 1, 11, 2, 17, 0, 0);
        let d = Math.max(0, Math.floor((target - now.getTime()) / 1000));
        const parts = [Math.floor(d / 86400), Math.floor(d % 86400 / 3600), Math.floor(d % 3600 / 60), d % 60];
        ['days', 'hours', 'minutes', 'seconds'].forEach((name, i) => { const e = document.getElementById('cd-' + name); if (e)
            e.textContent = String(parts[i]).padStart(2, '0'); });
    }
    tick();
    countdownTimer = window.setInterval(tick, 1000);
}
function homePage() {
    const s = publicData?.settings || {};
    const headerTitle = (s['home.title'] || 'The Birthday Collection').trim();
    const titleWords = headerTitle.split(/\s+/);
    const titleFinal = titleWords.length > 1 ? titleWords.pop() : 'Collection';
    const titleFirst = titleWords.length ? titleWords.join(' ') : 'The Birthday';
    const intro = `<div class="home-cover" aria-hidden="true"><div class="cover-arch"><div class="cover-ring cover-ring-a"></div><div class="cover-ring cover-ring-b"></div><div class="cover-petal cover-petal-a"></div><div class="cover-petal cover-petal-b"></div><span class="cover-mark">T<span>✳</span></span><div class="cover-foil">AN INVITATION TO A LITTLE UNIVERSE</div></div><div class="cover-stamp">03<br><span>DEC</span></div><span class="cover-floating-one">✦</span><span class="cover-floating-two">✧</span></div>`;
    shell(`<section class="home-hero"><div class="home-glow"></div>${introStars()}<div class="hero-grain"></div><div class="home-content animate-in">
  <div class="hero-kicker"><span class="kicker-line"></span> A PERSONAL STORY, WRITTEN IN STARS <span class="kicker-line"></span></div>
  <p class="hero-overline">ISSUE Nº 001 <span>•</span> DECEMBER THIRD</p>
  <h1><span>${esc(titleFirst)}</span><em>${esc(titleFinal)}<span class="asterisk">✳</span></em></h1>
  <p class="hero-description">${esc(s['home.subtitle'] || 'A birthday wish, a little story, and every universe in between.')}<br><span>Celebrating ${esc(s['profile.name'] || 'Thiên Trí')} · ${esc(s['profile.birthday'] || '03/12/2007')}</span></p>
  <div class="hero-buttons"><a href="/worlds" data-link class="btn btn-light">Enter the Collection <span>↗</span></a><a href="/about" data-link class="text-button">Meet Thiên Trí <span>↗</span></a></div>
  <div class="birthday-count-label">COUNTING DOWN TO THE NEXT CHAPTER <span>✧</span></div>${countdown()}
  </div>${intro}<div class="hero-bottom-note"><span>SCROLL TO DISCOVER</span><span>FAMILY · FRIENDSHIP · THE FUTURE</span></div></section>
  <section class="home-after"><div class="after-number">01 / THE LITTLE THINGS</div><p>Some gifts are wrapped in paper. <em>Others live in memories.</em></p><a href="/worlds" data-link>Turn the page <span>↗</span></a></section>`, 'home');
    startCountdown();
    syncMusic(s['home.music_url'] || '/audio/intro.wav');
}
function worldsPage() {
    const cards = Object.keys(config).map((slug, i) => {
        const c = config[slug];
        const link = canEnter(slug) ? dataRoute(slug) : portalRoute(slug);
        return `<a href="${link}" data-link class="world-card world-card--${c.mode} animate-in" style="--i:${i}">
      <div class="world-card-bg"><span class="world-card-symbol">${c.symbol}</span><span class="world-circle"></span></div>
      <div class="world-card-top"><span>${c.chapter}</span><span class="world-access">${canEnter(slug) ? 'UNLOCKED' : 'PRIVATE ✦'}</span></div>
      <div class="world-card-middle"><span class="world-small">${esc(c.sign)}</span><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p></div>
      <div class="world-card-bottom"><span>${esc(c.name)}</span><span class="circle-arrow">↗</span></div></a>`;
    }).join('');
    shell(`<section class="worlds-hero"><div class="worlds-topline"><span>THINTREÉ PRESENTS</span><span>VOL. 01 — THE BIRTHDAY EDITION</span></div><div class="worlds-heading animate-in">${revealTitle('THREE WORLDS · ONE HEART')}<h1>Choose your <em>chapter.</em></h1><p>Every friendship tells a different story. Which universe do you belong to?</p></div>
  <div class="world-grid">${cards}</div><div class="worlds-end">✳ &nbsp; PRIVATE LITTLE WORLDS — MADE FOR THE PEOPLE IN THEM &nbsp; ✳</div></section>`, 'worlds');
    syncMusic('/audio/intro.wav');
}
function photoCard(p, i, extra = '') {
    const media = p.url ? `<img src="${esc(p.url)}" loading="lazy" alt="${esc(p.caption)}">` : `<div class="photo-placeholder" aria-label="Vị trí ảnh chưa được thêm"><div class="placeholder-art"><span class="photo-star">✳</span><span class="photo-mountain">⌁</span><span class="photo-moon">◌</span></div><small>PLACE YOUR MEMORY HERE</small></div>`;
    return `<figure class="photo-card photo-card-${i % 4} ${extra}"><div class="photo-frame">${media}</div><figcaption><span>NO. ${String(i + 1).padStart(2, '0')}</span><span>${esc(p.caption)}</span></figcaption></figure>`;
}
function gallery(photos, slug) {
    const list = photos.filter(p => p.kind !== 'portrait');
    return `<section class="memories section-pad" id="memories">${sectionDivider('03', 'MEMORIES, FRAMED')}<div class="section-head-row"><div><h2>Little moments, <em>forever.</em></h2><p>Những chiếc khung đang chờ ảnh thật được bổ sung.</p></div><span class="gallery-corner">${esc(slug.toUpperCase())} / GALLERY</span></div><div class="photo-grid">${list.map((p, i) => photoCard(p, i)).join('') || `<p class="empty-note">No photos here yet. Add your first memory in Admin.</p>`}</div></section>`;
}
function aboutPage() {
    const data = publicData || { settings: {}, photos: [] };
    const s = data.settings;
    const portrait = data.photos.find(p => p.kind === 'portrait');
    const profileName = s['profile.name'] || 'Thiên Trí';
    const nameParts = profileName.split(/\s+/);
    const nameLast = nameParts.length > 1 ? nameParts.pop() : 'Trí';
    const nameFirst = nameParts.join(' ') || 'Thiên';
    const portraitUI = portrait?.url ? `<img class="portrait-photo" src="${esc(portrait.url)}" alt="Thiên Trí — ảnh chân dung">` : `<div class="portrait-placeholder"><span class="portrait-sun">✷</span><span class="portrait-monogram">T<span>r</span></span><span class="portrait-upload">YOUR PORTRAIT GOES HERE</span></div>`;
    const fun = (s['profile.facts'] || '').split('\n').map(t => t.trim()).filter(Boolean);
    shell(`<div class="about-page"><section class="about-hero"><div class="about-aside"><span>THE PERSON BEHIND THE UNIVERSE</span><span>VOL. ONE / PERSONAL NOTES</span></div>
    <div class="about-layout"><div class="about-portrait">${portraitUI}<div class="portrait-ribbon">A MOST PERSONAL COLLECTION ✴</div></div>
    <div class="about-copy animate-in">${revealTitle('DEAR READER, MEET')}<h1>${esc(nameFirst)} <em>${esc(nameLast)}.</em></h1><span class="about-subhead">A curious soul in a very big universe.</span>
    <p>${esc(s['profile.intro'] || '')}</p><div class="profile-line"><span>NAME</span><strong>${esc(s['profile.name'] || 'Thiên Trí')}</strong></div><div class="profile-line"><span>BRAND</span><strong>${esc(s['profile.brand'] || 'ThinTreé')}</strong></div><div class="profile-line"><span>BORN</span><strong>${esc(s['profile.birthday'] || '03/12/2007')}</strong></div><div class="profile-line"><span>STAR SIGN</span><strong>${esc(s['profile.zodiac'] || 'Nhân Mã')} ♐</strong></div><div class="profile-line"><span>STUDYING</span><strong>${esc(s['profile.major'] || 'Công nghệ thông tin')}</strong></div>
    </div></div><div class="about-hero-bottom">THE ART OF BEING YOURSELF <span>✦</span> EST. 03.12.2007</div></section>
    <section class="interests section-pad">${sectionDivider('01', 'THE THINGS I LOVE')}<div class="section-head-row"><div><h2>A constellation <em>of interests.</em></h2><p>All the little things that make life more interesting.</p></div><span class="gallery-corner">BEYOND A BIO</span></div><div class="interest-grid">${hobbies.map(h => `<article class="interest-card"><span class="interest-icon">${h.icon}</span><span class="interest-tag">${esc(h.tag)}</span><h3>${esc(h.title)}</h3><div class="interest-items">${h.items.map(t => `<span>${esc(t)}</span>`).join('')}</div></article>`).join('')}</div></section>
    <section class="fun-facts section-pad">${sectionDivider('02', 'BETWEEN THE LINES')}<div class="fun-layout"><div><h2>Fun <em>facts</em><span class="fun-dot">✳</span></h2><p>A few things you might not guess at first.</p></div><ol>${fun.map((x, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(x)}</li>`).join('')}</ol></div></section>
    ${gallery(data.photos, 'about')}<section class="back-worlds"><p>Now that you know me a little…</p><h2>Come see the <em>collection.</em></h2><a class="btn btn-dark" href="/worlds" data-link>Explore the worlds <span>↗</span></a></section></div>`, 'about');
    syncMusic('/audio/intro.wav');
}
function portalArt(s) {
    if (s === 'family')
        return `<div class="portal-art portal-envelope"><span>✿</span><div class="portal-envelope-shape">♡</div><small>SEALED WITH LOVE</small></div>`;
    if (s === 'high-school')
        return `<div class="portal-art portal-note"><div class="tape"></div><small>dear you,</small><span>our days<br>together</span><i>✎</i></div>`;
    return `<div class="portal-art portal-tarot"><div class="portal-tarot-frame"><span>✦ THE FOOL ✦</span><strong>☽</strong><small>0 · THE BEGINNING</small></div></div>`;
}
async function portalPage(slug) {
    const info = await api(`/api/portal/${slug}`), c = config[slug];
    shell(`<section class="portal-page portal--${c.mode}"><div class="portal-layout"><div class="portal-visual"><div class="portal-visual-content"><span class="eyebrow">${c.chapter} · PRIVATE ENTRANCE</span><h1>${esc(info.title)}</h1><p>${esc(info.subtitle)}</p>${portalArt(slug)}</div></div>
    <div class="portal-form-wrap animate-in"><div class="portal-card"><span class="portal-small">THINTREÉ / PRIVATE ARCHIVE</span><div class="portal-lock">✳</div><span class="eyebrow">A LITTLE SECRET BETWEEN US</span><h2>Only for <em>${esc(info.label)}.</em></h2><p>Trả lời câu hỏi nhỏ này để mở một góc kỷ niệm riêng.</p>
    <form data-form="gate" data-slug="${slug}" class="question-form"><label for="gate-answer">${esc(info.question)}</label><input id="gate-answer" type="text" name="answer" maxlength="160" required autocomplete="off" placeholder="Your answer goes here..." spellcheck="false"><button class="btn btn-dark" type="submit">Unlock this chapter <span>→</span></button><p class="form-info">Có tối đa 5 lần thử trước khi cổng tạm khóa 15 phút.</p></form>
    <a class="simple-back" href="/worlds" data-link>← Return to the collection</a></div></div></div></section>`, c.mode);
    syncMusic('/audio/intro.wav');
}
function familyArt() { return `<div class="floating-flowers" aria-hidden="true"><span>✿</span><span>✽</span><span>♡</span><span>✿</span><span>♡</span><span>✿</span></div>`; }
function universeArt() { return `<div class="universe-art" aria-hidden="true"><div class="stars stars-one"></div><div class="stars stars-two"></div><div class="cosmic-orbit orbit-one"></div><div class="cosmic-orbit orbit-two"></div><div class="cosmic-moon"></div><div class="cosmic-swirl swirl-one"></div><div class="cosmic-swirl swirl-two"></div><div class="cosmic-star-large">✦</div><div class="cosmic-star-small">✧</div></div>`; }
function collectionCover(slug) {
    if (slug === 'family')
        return `<button type="button" class="wishlist-gateway envelope-gateway ${revealOpen ? 'opened' : ''}" data-action="reveal" aria-expanded="${revealOpen}" aria-label="Mở phong bì wishlist"><div class="envelope-body"><div class="envelope-back"></div><div class="envelope-paper"><span>THE LITTLE THINGS I WISH FOR</span><strong>WISHLIST</strong><small>with love, Thiên Trí</small></div><div class="envelope-flap"></div><div class="envelope-front"><span>W I S H L I S T</span></div><div class="wax-seal">TT<span>✳</span></div></div><span class="cover-tap">${revealOpen ? '✧ THE ENVELOPE IS OPEN' : '✧ CLICK TO UNSEAL THE LETTER'}</span></button>`;
    if (slug === 'high-school')
        return `<button type="button" class="wishlist-gateway journal-gateway ${revealOpen ? 'opened' : ''}" data-action="reveal" aria-expanded="${revealOpen}" aria-label="Mở quyển lưu bút wishlist"><div class="journal-body"><div class="journal-pages"><span>dear diary,<br>the best days are kept here.</span><i>♥</i></div><div class="journal-cover"><span class="journal-label">A NOTEBOOK OF MEMORIES</span><span class="journal-scribble">The days<br>we keep <b>♡</b></span><strong>WISHLIST</strong><small>VOL. 2007 · THIÊN TRÍ</small><span class="journal-flower">✿</span></div></div><span class="cover-tap">${revealOpen ? '✎ OUR NOTEBOOK IS OPEN' : '✎ CLICK TO TURN THE PAGE'}</span></button>`;
    return `<button type="button" class="wishlist-gateway tarot-gateway ${revealOpen ? 'opened' : ''}" data-action="reveal" aria-expanded="${revealOpen}" aria-label="Lật bài tarot wishlist"><div class="tarot-card-3d"><div class="tarot-face tarot-front"><div class="tarot-ornate"><span class="tarot-top">✦ &nbsp; 0 &nbsp; · &nbsp; THE FOOL / JOKER &nbsp; ✦</span><div class="tarot-scene"><div class="tarot-sun">✷</div><div class="tarot-planet">◌</div><div class="tarot-hills"></div><div class="tarot-path"></div><div class="tarot-traveler"><span class="travel-head"></span><span class="travel-body"></span><span class="travel-bag"></span></div><span class="tarot-flower">✿</span></div><div class="tarot-bottom"><span>THE BEGINNING OF EVERYTHING</span><strong>WISHLIST</strong><small>THINTREÉ · MMVII</small></div></div></div><div class="tarot-face tarot-back"><div class="tarot-back-border"><span>✦ · ✧ · ✦</span><strong>The stars<br>say <em>yes.</em></strong><span>WISHLIST UNLOCKED</span><i>☽</i></div></div></div><span class="cover-tap">${revealOpen ? '✧ THE CARD HAS BEEN REVEALED' : '✧ FLIP THE CARD TO SEE YOUR FATE'}</span></button>`;
}
function wishlistCards(data) {
    const gifts = data.gifts, available = gifts.filter(g => g.status === 'available').length;
    return `<div class="wishlist-results ${revealOpen ? 'revealed' : ''}" id="gift-results" ${revealOpen ? '' : 'inert'}>
    <div class="wishlist-top"><span>${esc(String(gifts.length).padStart(2, '0'))} LITTLE WISHES</span><span>${available} STILL UNCLAIMED</span></div>
    <div class="section-head-row"><div><h2>The things that <em>make me smile.</em></h2><p>Nhấn vào từng món quà để xem chi tiết. Trạng thái được cập nhật cho tất cả nhóm.</p></div><button class="btn btn-outline" data-action="surprise">✦ Surprise Me</button></div>
    <div class="gift-grid">${gifts.map((g, i) => `<article class="gift-card" style="--i:${i}"><div class="gift-image" data-action="gift" data-id="${g.id}" role="button" tabindex="0" aria-label="Chi tiết ${esc(g.title)}">${g.imageUrl ? `<img src="${esc(g.imageUrl)}" alt="${esc(g.title)}" loading="lazy">` : `<div class="gift-illustration">${esc(g.illustration)}</div>`}<span class="gift-index">${String(i + 1).padStart(2, '0')}</span></div><div class="gift-info"><span class="gift-status ${g.status}"><i></i>${g.status === 'available' ? 'AVAILABLE' : g.status === 'reserved' ? 'SOMEONE PICKED THIS' : 'ALREADY GIFTED'}</span><button data-action="gift" data-id="${g.id}" class="gift-name">${esc(g.title)}</button><p>${esc(g.description)}</p><div class="gift-bottom"><span>VIEW DETAILS ↗</span><button data-action="reserve" data-id="${g.id}" ${g.status !== 'available' ? 'disabled' : ''} aria-label="${g.status === 'available' ? 'Đánh dấu quà đã chọn' : 'Quà đã được chọn'}">${g.status === 'available' ? '♡ PICK THIS' : g.status === 'reserved' ? '✓ PICKED' : '✓ GIFTED'}</button></div></div></article>`).join('')}</div>
    <p class="gift-note">✳ Trạng thái quà được chia sẻ giữa các wishlist có cùng món. Không hiển thị danh tính người chọn. Chỉ chủ website có thể hoàn tác.</p>
    </div>`;
}
function letters(data) {
    return `<section class="letter-section section-pad" id="letter">${sectionDivider('01', 'WORDS FROM THE HEART')}
    <div class="letter-layout"><div class="letter-context"><span class="tiny-ornament">✳</span><h2>Some things<br>are better<br><em>felt than said.</em></h2><p>Dear you, this is the little piece of my heart that belongs in your chapter.</p><span class="signature-small">FROM, THIÊN TRÍ</span></div>
    <blockquote class="heart-letter"><span class="quote-mark">“</span><p>${esc(data.section.letter)}</p><span class="letter-rule"></span><span class="letter-signature">With all my love, <em>Trí ♡</em></span></blockquote></div></section>`;
}
function timeline(data) { return `<section class="timeline-section section-pad">${sectionDivider('02', 'OUR LITTLE TIMELINE')}<div class="section-head-row"><div><h2>Once upon <em>a schoolday.</em></h2><p>Những cột mốc mẫu — thay bằng kỷ niệm thật trong trang Admin.</p></div><span class="scribble">remember this? ↝</span></div><div class="timeline-line">${data.timeline.map(t => `<article class="timeline-item"><span class="timeline-year">${esc(t.yearLabel)}</span><div class="timeline-pin"></div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p></article>`).join('')}</div></section>`; }
function wishesSection(data) {
    return `<section class="wishes-section section-pad" id="wishes">${sectionDivider('04', 'FROM YOU, TO ME')}<div class="wish-layout"><div class="wishes-intro"><span class="eyebrow">LEAVE A LITTLE LIGHT</span><h2>A note to <em>remember.</em></h2><p>Gửi một lời chúc ẩn danh cho Thiên Trí. Lời nhắn chỉ chủ website xem được, trừ khi được chủ website duyệt để hiển thị công khai.</p><div class="wish-sticker">you matter,<br>you always did ♡</div></div>
  <form class="wish-form" data-form="wish" data-slug="${data.section.slug}"><label for="wish-body">YOUR SECRET MESSAGE</label><textarea id="wish-body" name="body" rows="5" maxlength="1000" required placeholder="Dear Trí, ..."></textarea><div class="wish-form-bottom"><span>ANONYMOUS · PRIVATE BY DEFAULT</span><button type="submit" class="btn btn-dark">Send this little note <span>↗</span></button></div></form></div>
  <div class="approved-wishes"><h3>Letters on the wall <span>✳</span></h3>${data.wishes.length ? `<div class="wish-note-grid">${data.wishes.map(w => `<div class="wish-note"><span>✦ ${esc(w.author)}</span><p>${esc(w.body)}</p><small>${time(w.createdAt)}</small></div>`).join('')}</div>` : `<div class="empty-letters"><span>✎</span><p>A little blank page for future wishes.</p><small>Lời chúc được chủ website duyệt sẽ xuất hiện ở đây.</small></div>`}</div></section>`;
}
function collectionPage(data) {
    const slug = data.section.slug, c = config[slug], theme = c.mode;
    const extra = slug === 'family' ? familyArt() : slug === 'university' ? universeArt() : `<div class="school-doodles" aria-hidden="true"><span>✐</span><span>♡</span><span>✳</span><span>✎</span></div>`;
    const themeQuote = slug === 'family' ? 'A universe of unconditional love.' : slug === 'high-school' ? 'If only we could stay in those days.' : 'Every great journey begins at zero.';
    shell(`<div class="collection-page collection--${theme}"><section class="collection-hero">${extra}<div class="collection-hero-inner animate-in"><span class="eyebrow">THINTREÉ / ${esc(c.chapter)} <span class="hero-division">✦</span> THE BIRTHDAY COLLECTION</span>
    <p class="collection-handwriting">${esc(c.sign.toLowerCase())}</p><h1>${esc(data.section.title.split(' ').slice(0, -1).join(' '))}<em> ${esc(data.section.title.split(' ').slice(-1)[0])}</em></h1><p class="collection-subtitle">${esc(data.section.subtitle)}</p><div class="collection-hero-actions"><a href="#letter" class="btn btn-hero" data-anchor>Read my letter <span>↓</span></a><span class="collection-scroll">SCROLL TO UNFOLD THE STORY ↓</span></div></div>
    <div class="collection-hero-foot"><span>${esc(c.name.toUpperCase())} · PERSONAL EDITION</span><span>${esc(themeQuote)}</span><span>03 / 12 / 2007</span></div></section>
    ${letters(data)}<section class="wishlist-section section-pad" id="wishlist">${sectionDivider('02', 'A LITTLE WISH LIST')}<div class="wishlist-heading"><span class="eyebrow">A SURPRISE IS WAITING</span><h2>Unwrap a <em>little wish.</em></h2><p>${slug === 'family' ? 'Mở phong bì để khám phá những điều ước nhỏ.' : slug === 'high-school' ? 'Lật trang lưu bút và cùng mở món quà kỷ niệm.' : 'Turn the tarot card. Your next discovery awaits.'}</p></div>${collectionCover(slug)}${wishlistCards(data)}</section>
    ${slug === 'high-school' ? timeline(data) : ''}${gallery(data.photos, slug)}${wishesSection(data)}<section class="collection-close"><span>✳</span><h2>Thank you for <em>being here.</em></h2><p>${slug === 'family' ? 'Cảm ơn gia đình vì đã luôn ở đây, trong mọi vũ trụ.' : slug === 'high-school' ? 'Vì có chúng ta, những ngày ấy mới thật đẹp.' : 'To the beautiful beginning of everything yet to come.'}</p><a href="/worlds" data-link class="btn btn-hero">Explore another chapter <span>↗</span></a></section></div>`, theme);
    syncMusic(data.section.music_url || '/audio/intro.wav');
}
function adminLoginPage() {
    shell(`<section class="admin-login"><div class="admin-login-box"><span class="eyebrow">THINTREÉ · OWNER ONLY</span><span class="admin-lock">✳</span><h1>The Keeper’s <em>Room.</em></h1><p>Only the website owner can curate this little universe.</p><form data-form="admin-login"><label for="admin-password">ADMIN PASSWORD</label><input type="password" autocomplete="current-password" id="admin-password" name="password" required placeholder="Enter your private password"><button type="submit" class="btn btn-dark">Enter Admin Mode →</button></form><a href="/" data-link class="simple-back">← Back to collection</a></div></section>`, 'admin');
    syncMusic('/audio/intro.wav');
}
function notFound() { shell(`<section class="not-found"><div class="notfound-orbit">✳</div><span class="eyebrow">AN UNWRITTEN PAGE</span><h1>4<em>0</em>4</h1><p>Even in a thousand universes, this page doesn't exist. Yet.</p><a class="btn btn-dark" href="/" data-link>Find your way home <span>↗</span></a></section>`, 'home'); syncMusic('/audio/intro.wav'); }
function adminField(label, name, value, large = false) {
    return `<label class="admin-field"><span>${esc(label)}</span>${large ? `<textarea name="${esc(name)}" rows="${name === 'letter' ? 5 : 3}">${esc(value)}</textarea>` : `<input name="${esc(name)}" value="${esc(value)}">`}</label>`;
}
function adminOverview(d) {
    const count = (slug) => d.gifts.filter(g => g.slug === slug).length;
    const selected = d.gifts.filter(g => g.status !== 'available').length;
    return `<div class="admin-summary-grid"><div class="admin-stat"><span>TOTAL WISHES</span><strong>${d.gifts.length}</strong><small>Across three collections</small></div><div class="admin-stat"><span>GIFTS SELECTED</span><strong>${selected}</strong><small>Status linked across chapters</small></div><div class="admin-stat"><span>SECRET MESSAGES</span><strong>${d.messages.filter(m => !m.approved).length}</strong><small>Waiting in the inbox</small></div><div class="admin-stat"><span>MEMORY FRAMES</span><strong>${d.photos.length}</strong><small>Upload or replace photos</small></div></div>
   <div class="admin-quick-list"><h3>Curate the chapters</h3>${Object.keys(config).map(s => `<div><span>${esc(config[s].name)}</span><span>${count(s)} gifts</span><button data-action="admin-group" data-group="${s}" data-tab="gifts">Manage ↗</button></div>`).join('')}</div>
   <div class="admin-help"><strong>✳ Everything here saves to SQLite.</strong><p>Gift claims sync across chapters by canonical key. Photos and messages are private unless you deliberately approve publication. Changes take effect immediately.</p></div>`;
}
function adminContent(d) {
    const s = d.sections.find(s => s.slug === adminGroup);
    const settingKeys = [
        ['home.title', 'Homepage title', false], ['home.subtitle', 'Homepage subtitle', true], ['home.music_url', 'Homepage music URL', false],
        ['profile.name', 'Name', false], ['profile.brand', 'Brand', false], ['profile.birthday', 'Birth date', false], ['profile.major', 'Major', false], ['profile.zodiac', 'Zodiac', false],
        ['profile.intro', 'About biography', true], ['profile.facts', 'Fun facts (one per line)', true]
    ];
    return `<div class="admin-columns"><section class="admin-pane"><h3>Edit ${esc(s.label)} chapter</h3><p>Change the message, title, question, atmosphere and soundtrack.</p>
    <form data-form="admin-section" data-slug="${s.slug}" class="admin-stack">${adminField('Label', 'label', s.label)}${adminField('Page title', 'title', s.title)}${adminField('Subtitle', 'subtitle', s.subtitle, true)}${adminField('Heartfelt letter · exact text by default', 'letter', s.letter, true)}${adminField('Gate question (changing question does not change answer)', 'question', s.question, true)}${adminField('Intro note', 'intro', s.intro, true)}${adminField('Background music URL', 'music_url', s.music_url)}<button class="btn btn-dark" type="submit">Save chapter changes ↗</button></form></section>
    <section class="admin-pane"><h3>Home & personal profile</h3><p>Update the public introduction and About Me. Changes save individually.</p>
    <div class="admin-stack">${settingKeys.map(([key, label, large]) => `<form data-form="admin-setting" data-key="${esc(key)}" class="admin-single-setting">${adminField(label, 'value', d.settings[key] || '', large)}<button type="submit">Save ↗</button></form>`).join('')}</div></section></div>`;
}
function adminGifts(d) {
    const gifts = d.gifts.filter(g => g.slug === adminGroup);
    return `<section class="admin-pane"><h3>${esc(config[adminGroup].name)} wishlist <span class="admin-subcount">${gifts.length} gifts</span></h3><p>Add gifts, edit details or change shared reservation status. Matching canonical keys prevent duplicate gifts across groups.</p>
   <form class="admin-add-grid" data-form="add-gift" data-slug="${adminGroup}">${adminField('Gift title', 'title', '')}${adminField('Shared key (optional; leave blank to generate)', 'canonicalKey', '')}${adminField('Description', 'description', '', true)}${adminField('Note', 'note', '', true)}${adminField('Symbol / emoji', 'illustration', '✧')}${adminField('Image URL (optional)', 'imageUrl', '')}<button class="btn btn-dark" type="submit">+ Add gift</button></form>
   <div class="admin-gift-list">${gifts.map(g => `<article class="admin-gift-row"><div class="admin-gift-top"><div class="admin-gift-symbol">${esc(g.illustration)}</div><div><strong>${esc(g.title)}</strong><small>Key: ${esc(g.canonicalKey)}</small></div><select data-action="gift-status" data-key="${esc(g.canonicalKey)}" aria-label="Trạng thái ${esc(g.title)}"><option value="available" ${g.status === 'available' ? 'selected' : ''}>Available</option><option value="reserved" ${g.status === 'reserved' ? 'selected' : ''}>Reserved</option><option value="purchased" ${g.status === 'purchased' ? 'selected' : ''}>Purchased</option></select><button class="admin-danger" data-action="delete-gift" data-id="${g.id}">Delete</button></div>
    <details class="admin-edit-details"><summary>Edit details ↓</summary><form data-form="edit-gift" data-id="${g.id}" class="admin-add-grid">${adminField('Name', 'title', g.title)}${adminField('Symbol', 'illustration', g.illustration)}${adminField('Description', 'description', g.description, true)}${adminField('Note', 'note', g.note, true)}${adminField('Image URL', 'imageUrl', g.imageUrl)}<button class="btn btn-dark" type="submit">Save details ↗</button></form></details></article>`).join('')}</div></section>`;
}
function adminPhotos(d) {
    const all = ['about', ...Object.keys(config)];
    return `<section class="admin-pane"><h3>Memory gallery <span class="admin-subcount">${d.photos.length} frames</span></h3><p>Upload real images from your device (PNG/JPEG/WebP, 5MB max). Images are stored in the database, and private albums are protected by login.</p>
    <form data-form="upload-photo" class="admin-upload-form" enctype="multipart/form-data"><label class="admin-field"><span>Album</span><select name="slug" id="upload-slug">${all.map(s => `<option value="${s}" ${s === adminGroup ? 'selected' : ''}>${s === 'about' ? 'About / Public' : config[s]?.name}</option>`).join('')}</select></label>
    <label class="admin-field"><span>Image type</span><select name="kind"><option value="gallery">Gallery memory</option><option value="portrait">About Me portrait (choose About)</option></select></label>${adminField('Caption', 'caption', 'A memory worth keeping')}<label class="admin-field"><span>Replace an existing frame (optional)</span><select name="replaceId"><option value="">Add new image</option>${d.photos.map(p => `<option value="${p.id}">${esc(p.slug)} — ${esc(p.caption)}</option>`).join('')}</select></label><label class="admin-field"><span>Choose image file</span><input type="file" name="file" accept="image/png,image/jpeg,image/webp" required></label><button class="btn btn-dark" type="submit">Upload & save photo ↗</button></form>
    <div class="admin-photo-grid">${d.photos.map(p => `<article class="admin-photo-card"><div class="admin-photo-thumb">${p.imageId ? `<img src="/api/media/${p.imageId}" loading="lazy" alt="${esc(p.caption)}">` : `<span>✳<small>PLACEHOLDER</small></span>`}</div><div class="admin-photo-meta"><strong>${esc(p.slug)} · ${esc(p.kind)}</strong><form data-form="edit-photo" data-id="${p.id}"><input name="caption" value="${esc(p.caption)}" aria-label="Caption"><button type="submit">Save</button></form><button class="admin-danger" data-action="delete-photo" data-id="${p.id}">Remove frame</button></div></article>`).join('')}</div></section>`;
}
function adminMessages(d) {
    return `<section class="admin-pane"><h3>Secret notes inbox <span class="admin-subcount">${d.messages.length} total</span></h3><p>Anonymous messages are not published automatically. You can choose whether to show each note on its chapter's wall.</p>
    <form class="admin-add-grid" data-form="add-message"><label class="admin-field"><span>Chapter</span><select name="slug">${Object.keys(config).map(s => `<option value="${s}">${esc(config[s].name)}</option>`).join('')}</select></label>${adminField('Written by', 'author', 'Một người bạn')}${adminField('Your greeting', 'body', '', true)}<button class="btn btn-dark" type="submit">Publish a greeting ↗</button></form>
    <div class="admin-message-list">${d.messages.map(m => `<article class="admin-message"><div class="admin-message-heading"><strong>${esc(config[m.slug]?.name || m.slug)}</strong><span>${time(m.createdAt)} · ${m.approved && m.isPublic ? 'PUBLIC' : 'PRIVATE'}</span></div><p>${esc(m.body)}</p><small>From: ${esc(m.author)}</small><div class="admin-message-actions"><button data-action="message-publish" data-id="${m.id}" data-public="${m.approved && m.isPublic ? '0' : '1'}">${m.approved && m.isPublic ? 'Make private' : 'Approve & publish'}</button><button class="admin-danger" data-action="delete-message" data-id="${m.id}">Delete</button></div></article>`).join('') || '<p>No greetings yet.</p>'}</div></section>`;
}
function adminTimeline(d) {
    const list = d.timelines.filter(t => t.slug === adminGroup);
    return `<section class="admin-pane"><h3>Timeline editor</h3><p>Edit the personal milestones of ${esc(config[adminGroup].name)}. The High School timeline is already displayed in its chapter.</p>
    <form class="admin-add-grid" data-form="add-timeline" data-slug="${adminGroup}">${adminField('Date / label', 'yearLabel', '04')}${adminField('Title', 'title', 'Another unforgettable day')}${adminField('Story', 'description', '', true)}<button class="btn btn-dark" type="submit">+ Add memory milestone</button></form>
    <div class="admin-gift-list">${list.map(t => `<article class="admin-gift-row"><form class="admin-add-grid" data-form="edit-timeline" data-id="${t.id}">${adminField('Label', 'yearLabel', t.yearLabel)}${adminField('Title', 'title', t.title)}${adminField('Description', 'description', t.description, true)}<button class="btn btn-dark" type="submit">Save</button></form><button class="admin-danger" data-action="delete-timeline" data-id="${t.id}">Delete milestone</button></article>`).join('')}</div></section>`;
}
function adminSecurity(d) {
    return `<div class="admin-columns"><section class="admin-pane"><h3>Change a gate answer</h3><p>Answers are salted and hashed in the backend. Enter one accepted answer per line. Changing answers ends old sessions for the group.</p>
    <form data-form="admin-gate" data-slug="${adminGroup}" class="admin-stack"><p class="admin-security-question"><strong>Current question:</strong> ${esc(d.sections.find(s => s.slug === adminGroup)?.question)}</p><label class="admin-field"><span>New accepted answers (1–5, one per line)</span><textarea required name="answers" rows="5" placeholder="Type new answers. Current answers are not retrievable."></textarea></label><button class="btn btn-dark" type="submit">Rotate gate answers ↗</button></form></section>
    <section class="admin-pane"><h3>Owner password</h3><p>Change the admin password whenever needed. All admin sessions will be revoked.</p><form data-form="admin-password" class="admin-stack"><label class="admin-field"><span>New admin password (at least 12 characters)</span><input type="password" name="password" minlength="12" required autocomplete="new-password"></label><button class="btn btn-dark" type="submit">Change admin password ↗</button></form>
    <div class="admin-help"><strong>SECURITY NOTES</strong><p>No login secret is sent to the frontend. Sessions use server-side random tokens in HttpOnly cookies. Browser storage does not grant access.</p></div></section></div>`;
}
function adminPage(d) {
    const tabs = [['overview', 'Overview'], ['content', 'Page content'], ['gifts', 'Gifts'], ['photos', 'Photos'], ['messages', 'Secret notes'], ['timeline', 'Timeline'], ['security', 'Access & security']];
    const showGroup = !['overview', 'messages'].includes(adminTab);
    const content = adminTab === 'overview' ? adminOverview(d) : adminTab === 'content' ? adminContent(d) : adminTab === 'gifts' ? adminGifts(d) : adminTab === 'photos' ? adminPhotos(d) : adminTab === 'messages' ? adminMessages(d) : adminTab === 'timeline' ? adminTimeline(d) : adminSecurity(d);
    shell(`<section class="admin-page"><div class="admin-masthead"><span class="eyebrow">AN EXCLUSIVE SPACE FOR THE STORYKEEPER</span><h1>The Keeper’s <em>Room.</em></h1><p>Every wish, every letter, every memory — yours to curate.</p></div>
    <div class="admin-layout"><aside class="admin-sidebar"><span class="admin-menu-label">THE CONTROL ROOM / 01</span>${tabs.map(([id, label]) => `<button data-action="admin-tab" data-tab="${id}" class="admin-tab ${adminTab === id ? 'active' : ''}">${esc(label)} <span>${adminTab === id ? '✦' : '↗'}</span></button>`).join('')}<a href="/worlds" data-link class="admin-view-link">← View the collection</a></aside>
    <div class="admin-content"><div class="admin-content-head"><h2>${esc(tabs.find(t => t[0] === adminTab)?.[1] || 'Overview')}</h2>${showGroup ? `<div class="admin-group-switch">${Object.keys(config).map(s => `<button class="${adminGroup === s ? 'active' : ''}" data-action="admin-group" data-group="${s}">${esc(config[s].name)}</button>`).join('')}</div>` : ''}</div>${content}</div></div></section>`, 'admin');
    syncMusic('/audio/intro.wav');
}
function closeModal() { modalRoot.innerHTML = ''; document.body.classList.remove('modal-open'); }
function giftModal(g) {
    const status = g.status === 'available' ? 'Available to choose' : g.status === 'reserved' ? 'Someone has chosen this gift' : 'Already gifted';
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="gift-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="Đóng">×</button><div class="gift-modal-art">${g.imageUrl ? `<img src="${esc(g.imageUrl)}" alt="${esc(g.title)}">` : `<div class="gift-modal-emoji">${esc(g.illustration)}</div>`}<span>THE BIRTHDAY COLLECTION ✴</span></div><div class="gift-modal-content"><span class="eyebrow">A LITTLE WISH / ${esc(config[g.slug].name.toUpperCase())}</span><h2 id="modal-title">${esc(g.title)}</h2><div class="modal-status ${g.status}">✦ ${esc(status)}</div><p>${esc(g.description)}</p><div class="modal-note"><strong>NOTE FROM THIÊN TRÍ</strong><p>${esc(g.note || 'Một món quà nhỏ với rất nhiều tình cảm.')}</p></div><button class="btn btn-dark" data-action="reserve" data-id="${g.id}" ${g.status !== 'available' ? 'disabled' : ''}>${g.status === 'available' ? '♡ I’ll choose this gift' : '✓ This wish is already claimed'}</button><small>Choosing a gift anonymously reserves the same item across chapters. Ask Trí to undo the reservation if needed.</small></div></section></div>`;
    document.body.classList.add('modal-open');
    modalRoot.querySelector('.modal-close')?.focus();
}
async function renderRoute() {
    const tick = ++renderSerial;
    closeModal();
    loader();
    if (countdownTimer)
        clearInterval(countdownTimer);
    try {
        session = await api('/api/auth/me');
        if (tick !== renderSerial)
            return;
        const path = decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/';
        if (['/', '/about', '/worlds'].includes(path)) {
            if (!publicData)
                publicData = await api('/api/public');
            if (tick !== renderSerial)
                return;
            if (path === '/')
                homePage();
            else if (path === '/about')
                aboutPage();
            else
                worldsPage();
            return;
        }
        const portal = path.match(/^\/portal\/(family|high-school|university)$/);
        if (portal) {
            await portalPage(portal[1]);
            return;
        }
        const collection = path.match(/^\/collection\/(family|high-school|university)$/);
        if (collection) {
            const slug = collection[1];
            if (!canEnter(slug)) {
                navigate(portalRoute(slug), true);
                return;
            }
            currentSection = await api(`/api/section/${slug}`);
            if (tick !== renderSerial)
                return;
            revealOpen = false;
            collectionPage(currentSection);
            return;
        }
        if (path === '/admin') {
            if (session.role !== 'admin') {
                adminLoginPage();
                return;
            }
            adminData = await api('/api/admin/state');
            if (tick !== renderSerial)
                return;
            adminPage(adminData);
            return;
        }
        notFound();
    }
    catch (e) {
        const message = e instanceof Error ? e.message : 'Không thể tải trang.';
        app.className = 'app-error';
        app.innerHTML = `${header()}<main class="error-page"><span>✳</span><h1>Something went wrong.</h1><p>${esc(message)}</p><button class="btn btn-dark" data-action="retry">Try again ↗</button></main>`;
    }
}
async function refreshSection(preserveY = true) {
    if (!currentSection)
        return;
    const y = window.scrollY;
    currentSection = await api(`/api/section/${currentSection.section.slug}`);
    collectionPage(currentSection);
    if (preserveY)
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
}
async function refreshAdmin() {
    const y = window.scrollY;
    adminData = await api('/api/admin/state');
    adminPage(adminData);
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
}
async function reserveGift(id) {
    if (!currentSection)
        return;
    const gift = currentSection.gifts.find(g => g.id === id);
    if (!gift || gift.status !== 'available')
        return;
    const yes = window.confirm(`Đánh dấu “${gift.title}” đã có người chọn? Trạng thái sẽ được đồng bộ ở mọi nhóm và chỉ Admin mới có thể hoàn tác.`);
    if (!yes)
        return;
    try {
        await api(`/api/gifts/${id}/reserve`, jsonOpts('POST', {}));
        closeModal();
        toast('Đã giữ món quà này. Cảm ơn bạn ♡');
        await refreshSection();
    }
    catch (e) {
        toast(e instanceof Error ? e.message : 'Không thể giữ quà.', 'bad');
        await refreshSection();
    }
}
function requireConfirm(action) { return window.confirm(`Bạn có chắc muốn ${action}? Thao tác này không thể hoàn tác.`); }
async function handleAction(button) {
    const a = button.dataset.action || '';
    if (a === 'back') {
        if (history.length > 1)
            history.back();
        else
            navigate('/worlds');
        return;
    }
    if (a === 'retry') {
        void renderRoute();
        return;
    }
    if (a === 'logout') {
        try {
            await api('/api/auth/logout', jsonOpts('POST', {}));
            stopMusic();
            publicData = null;
            currentSection = null;
            adminData = null;
            navigate('/', true);
            toast('Đã đăng xuất. Những trang riêng tư đã được khóa.');
        }
        catch (e) {
            toast(String(e), 'bad');
        }
        return;
    }
    if (a === 'music') {
        if (!music)
            syncMusic('/audio/intro.wav');
        if (!music)
            return;
        if (playing) {
            music.pause();
            playing = false;
        }
        else {
            try {
                await music.play();
                playing = true;
            }
            catch {
                toast('Không phát được nhạc từ nguồn này.', 'bad');
            }
        }
        const toggle = document.querySelector('.music-toggle');
        if (toggle)
            toggle.innerHTML = playing ? '❚❚ <span>PAUSE</span>' : '♫ <span>MUSIC</span>';
        return;
    }
    if (a === 'reveal') {
        revealOpen = !revealOpen;
        button.classList.toggle('opened', revealOpen);
        button.setAttribute('aria-expanded', String(revealOpen));
        const results = document.getElementById('gift-results');
        results?.classList.toggle('revealed', revealOpen);
        if (revealOpen)
            results?.removeAttribute('inert');
        else
            results?.setAttribute('inert', '');
        const tap = button.querySelector('.cover-tap');
        if (tap)
            tap.textContent = revealOpen ? '✦ THE WISHLIST IS OPEN' : '✧ CLICK TO OPEN THE WISHLIST';
        if (revealOpen)
            window.setTimeout(() => results?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 650);
        return;
    }
    if (a === 'gift') {
        const g = currentSection?.gifts.find(g => g.id === button.dataset.id);
        if (g)
            giftModal(g);
        return;
    }
    if (a === 'surprise') {
        const available = currentSection?.gifts.filter(g => g.status === 'available') || [];
        if (!available.length) {
            toast('Tất cả món quà đều đã được chọn. ♡', 'bad');
            return;
        }
        giftModal(available[Math.floor(Math.random() * available.length)]);
        return;
    }
    if (a === 'reserve') {
        await reserveGift(button.dataset.id || '');
        return;
    }
    if (a === 'close-modal') {
        closeModal();
        return;
    }
    if (a === 'admin-tab') {
        adminTab = button.dataset.tab || 'overview';
        if (adminData)
            adminPage(adminData);
        return;
    }
    if (a === 'admin-group') {
        if (slugIs(button.dataset.group || ''))
            adminGroup = button.dataset.group;
        if (button.dataset.tab)
            adminTab = button.dataset.tab;
        if (adminData)
            adminPage(adminData);
        return;
    }
    const id = button.dataset.id || '';
    try {
        if (a === 'delete-gift' && requireConfirm('xóa món quà'))
            await api(`/api/admin/gifts/${id}`, { method: 'DELETE' });
        else if (a === 'delete-photo' && requireConfirm('xóa ảnh và dữ liệu ảnh'))
            await api(`/api/admin/photos/${id}`, { method: 'DELETE' });
        else if (a === 'delete-message' && requireConfirm('xóa lời chúc'))
            await api(`/api/admin/messages/${id}`, { method: 'DELETE' });
        else if (a === 'delete-timeline' && requireConfirm('xóa mốc kỷ niệm'))
            await api(`/api/admin/timeline/${id}`, { method: 'DELETE' });
        else if (a === 'message-publish') {
            const pub = button.dataset.public === '1';
            await api(`/api/admin/messages/${id}`, jsonOpts('PUT', { isPublic: pub, approved: pub }));
        }
        else
            return;
        toast('Đã lưu thay đổi thành công.');
        await refreshAdmin();
    }
    catch (e) {
        toast(e instanceof Error ? e.message : 'Không lưu được.', 'bad');
    }
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
async function handleForm(form) {
    const kind = form.dataset.form || '';
    const data = formObject(form);
    const submit = form.querySelector('button[type="submit"]');
    if (submit)
        submit.disabled = true;
    try {
        if (kind === 'gate') {
            const slug = form.dataset.slug;
            await api('/api/auth/login', jsonOpts('POST', { slug, answer: String(data.answer || '') }));
            toast('Đúng rồi! Chào mừng vào góc nhỏ của Trí ✳');
            navigate(dataRoute(slug), true);
            return;
        }
        if (kind === 'admin-login') {
            await api('/api/admin/login', jsonOpts('POST', { password: String(data.password || '') }));
            adminTab = 'overview';
            navigate('/admin', true);
            return;
        }
        if (kind === 'wish') {
            await api(`/api/wishes/${form.dataset.slug}`, jsonOpts('POST', { body: String(data.body || '') }));
            form.querySelector('textarea').value = '';
            toast('Lời chúc bí mật đã được gửi đến Trí ♡');
            return;
        }
        if (kind === 'admin-setting') {
            await api('/api/admin/settings', jsonOpts('PUT', { key: form.dataset.key, value: String(data.value || '') }));
            publicData = null;
        }
        else if (kind === 'admin-section') {
            await api(`/api/admin/sections/${form.dataset.slug}`, jsonOpts('PUT', data));
        }
        else if (kind === 'add-gift') {
            await api('/api/admin/gifts', jsonOpts('POST', { ...data, slug: form.dataset.slug }));
        }
        else if (kind === 'edit-gift') {
            await api(`/api/admin/gifts/${form.dataset.id}`, jsonOpts('PUT', data));
        }
        else if (kind === 'upload-photo') {
            const upload = new FormData(form);
            await api('/api/admin/photos', { method: 'POST', body: upload });
            publicData = null;
        }
        else if (kind === 'edit-photo') {
            await api(`/api/admin/photos/${form.dataset.id}`, jsonOpts('PUT', data));
        }
        else if (kind === 'add-message') {
            await api('/api/admin/messages', jsonOpts('POST', data));
        }
        else if (kind === 'add-timeline') {
            await api('/api/admin/timeline', jsonOpts('POST', { ...data, slug: form.dataset.slug }));
        }
        else if (kind === 'edit-timeline') {
            await api(`/api/admin/timeline/${form.dataset.id}`, jsonOpts('PUT', data));
        }
        else if (kind === 'admin-gate') {
            const answers = String(data.answers || '').split('\n').map(s => s.trim()).filter(Boolean);
            if (!requireConfirm('thay toàn bộ đáp án và hủy session của nhóm'))
                return;
            await api(`/api/admin/gates/${form.dataset.slug}`, jsonOpts('PUT', { answers }));
        }
        else if (kind === 'admin-password') {
            if (!requireConfirm('đổi mật khẩu quản trị và đăng xuất mọi phiên'))
                return;
            await api('/api/admin/password', jsonOpts('PUT', data));
            toast('Mật khẩu đã đổi. Đăng nhập lại nhé.');
            navigate('/admin', true);
            return;
        }
        else
            return;
        toast('Thay đổi đã được lưu ♡');
        await refreshAdmin();
    }
    catch (e) {
        toast(e instanceof Error ? e.message : 'Đã xảy ra lỗi.', 'bad');
    }
    finally {
        if (submit && submit.isConnected)
            submit.disabled = false;
    }
}
document.addEventListener('click', event => {
    const target = event.target;
    const anchor = target.closest('a[data-link]');
    if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        navigate(anchor.getAttribute('href') || '/');
        return;
    }
    const inPage = target.closest('a[data-anchor]');
    if (inPage) {
        event.preventDefault();
        document.querySelector(inPage.getAttribute('href') || '')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    const action = target.closest('[data-action]');
    if (action) {
        if (action.dataset.action === 'close-modal' && target.closest('.gift-modal') && target !== action)
            return;
        event.preventDefault();
        void handleAction(action);
    }
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape')
        closeModal();
    if ((event.key === 'Enter' || event.key === ' ') && event.target?.matches('.gift-image[role="button"]')) {
        event.preventDefault();
        void handleAction(event.target);
    }
});
document.addEventListener('submit', event => {
    const form = event.target;
    if (form.matches('form[data-form]')) {
        event.preventDefault();
        void handleForm(form);
    }
});
document.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'music-volume' && music) {
        volume = Number(target.value) / 100;
        music.volume = volume;
    }
    if (target.dataset.action === 'gift-status') {
        void (async () => {
            try {
                await api('/api/admin/gift-status', jsonOpts('PUT', { canonicalKey: target.dataset.key, status: target.value }));
                toast('Trạng thái quà đã cập nhật trên mọi wishlist.');
                await refreshAdmin();
            }
            catch (e) {
                toast(e instanceof Error ? e.message : 'Lỗi cập nhật.', 'bad');
                await refreshAdmin();
            }
        })();
    }
});
document.addEventListener('input', event => {
    const target = event.target;
    if (target.id === 'music-volume') {
        volume = Number(target.value) / 100;
        if (music)
            music.volume = volume;
    }
});
window.addEventListener('popstate', () => { revealOpen = false; void renderRoute(); });
void renderRoute();
