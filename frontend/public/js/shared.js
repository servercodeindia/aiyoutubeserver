/* ===================================================
   shared.js — Reusable navbar, footer, downloader & UI
   All sub-pages use this single file.
   =================================================== */

const SITE_NAME = 'YouTubeServer';
const SITE_DOMAIN = 'youtubeserver.netlify.app';

/* ── Inject Navbar ── */
function injectNavbar(activePage = '') {
  const nav = `
  <header class="navbar" id="navbar">
    <div class="container nav-inner">
      <a href="/" class="logo" aria-label="${SITE_NAME} Home">
        <img src="/logo.png" alt="${SITE_NAME} Logo" style="height: 70px; width: auto; max-width: 300px; margin-top: 4px;">
      </a>
      <nav class="nav-links" id="navLinks" role="navigation" aria-label="Main navigation">
        <span class="nav-text-main">All-in-One Video Downloader</span>
        <span class="nav-text">YouTube · Facebook · Instagram · Twitter · TikTok</span>
      </nav>
      <div class="nav-right">
        <div class="lang-selector" id="langSelector">
          <button class="lang-btn" id="langBtn" aria-haspopup="listbox" aria-expanded="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span>English</span>
            <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <ul class="lang-dropdown" id="langDropdown" role="listbox">
            <li><a href="/">English</a></li>
            <li><a href="/">Français</a></li>
            <li><a href="/">Deutsch</a></li>
            <li><a href="/">Español</a></li>
            <li><a href="/">Português</a></li>
            <li><a href="/">Italiano</a></li>
            <li><a href="/">日本語</a></li>
            <li><a href="/">한국어</a></li>
            <li><a href="/">हिन्दी</a></li>
            <li><a href="/">العربية</a></li>
          </ul>
        </div>
        <button class="hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>`;
  document.body.insertAdjacentHTML('afterbegin', nav);

  // Hamburger logic
  const hb = document.getElementById('hamburger');
  const nl = document.getElementById('navLinks');
  if (hb && nl) {
    hb.addEventListener('click', () => {
      const open = hb.classList.toggle('open');
      hb.setAttribute('aria-expanded', open);
      nl.classList.toggle('mobile-open', open);
    });
    // Close menu on link click
    nl.querySelectorAll('.nav-link').forEach(a => {
      a.addEventListener('click', () => {
        hb.classList.remove('open');
        nl.classList.remove('mobile-open');
        hb.setAttribute('aria-expanded', false);
      });
    });
  }

  // Language dropdown
  const langBtn = document.getElementById('langBtn');
  const langDropdown = document.getElementById('langDropdown');
  if (langBtn && langDropdown) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = langDropdown.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', () => {
      langDropdown.classList.remove('open');
      langBtn.setAttribute('aria-expanded', false);
    });
  }

  // Scroll effect
  window.addEventListener('scroll', () => {
    const nb = document.getElementById('navbar');
    if (nb) nb.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

/* ── Inject Footer ── */
function injectFooter() {
  const yr = new Date().getFullYear();
  const footer = `
  <footer class="footer" id="footer">
    <div class="container footer-inner">
      <div class="footer-col">
        <a href="/" class="logo footer-logo" aria-label="${SITE_NAME} Home">
          <img src="/logo.png" alt="${SITE_NAME} Logo" style="height: 85px; width: auto; max-width: 350px; filter: brightness(0) invert(1);">
        </a>
        <p class="footer-desc">The best free online video downloader. Download YouTube, Facebook, Instagram, Twitter & TikTok videos in HD, 4K and 8K quality safely and fast on any device.</p>
        <a href="/" class="footer-dl-btn" id="footerDlBtn">Download NOW</a>
        
        <!-- Social Media Links -->
        <div class="footer-social">
          <h4 class="footer-social-heading">FOLLOW US</h4>
          <div class="social-links">
            <a href="https://instagram.com/network.tsx" target="_blank" rel="noopener noreferrer" class="social-link instagram" aria-label="Follow us on Instagram">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>@network.tsx</span>
            </a>
          </div>
        </div>
        
        <p class="footer-thanks">Thank you for using our service.<br />Share us with your friends!</p>
      </div>
      <div class="footer-col">
        <h4 class="footer-heading">QUICK LINKS</h4>
        <ul class="footer-links">
          <li><a href="/copyright">Copyright</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/terms-of-use">Terms of Service</a></li>
          <li><a href="/privacy-policy">Privacy Policy</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4 class="footer-heading">TOOLS</h4>
        <ul class="footer-links">
          <li><a href="/youtube-to-mp3">YouTube to MP3</a></li>
          <li><a href="/facebook-video-downloader">Facebook Downloader</a></li>
          <li><a href="/instagram-downloader">Instagram Downloader</a></li>
          <li><a href="/twitter-downloader">Twitter Downloader</a></li>
          <li><a href="/tiktok-downloader">TikTok Downloader</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container">
        <p>&copy; ${yr} YouTubeServer.com — Free Online Video Downloader</p>
      </div>
    </div>
  </footer>`;
  document.body.insertAdjacentHTML('beforeend', footer);
}

/* ── Utility Functions ── */
function fmtDuration(secs) {
  const s = parseInt(secs, 10), m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
function fmtBytes(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}
function formatQualityLabel(q) {
  if (!q) return '';
  const s = String(q).toLowerCase();
  if (s.includes('7680x4320') || s.includes('4320p')) return '8K';
  if (s.includes('3840x2160') || s.includes('2160p')) return '4K';
  if (s.includes('2560x1440') || s.includes('1440p')) return '2K';
  if (s.includes('1920x1080') || s.includes('1080p')) return '1080p';
  if (s.includes('1280x720') || s.includes('720p')) return '720p';
  if (s.includes('854x480') || s.includes('480p')) return '480p';
  if (s.includes('640x360') || s.includes('360p')) return '360p';
  if (s.includes('426x240') || s.includes('240p')) return '240p';
  if (s.includes('256x144') || s.includes('144p')) return '144p';
  return q;
}
function showEl(id) { const e = document.getElementById(id); if (e) e.style.display = 'block'; }
function hideEl(id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
function setText(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }

/* ── Instant Download (no new tab, no popup) ── */
function triggerInstantDownload(url, filename, ext = 'mp4') {
  // Show download progress notification
  showDownloadProgress(filename, ext);
  
  // Use iframe for reliable downloads (prevents browser timeout)
  // This approach keeps the connection alive even if yt-dlp takes time to start
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  
  // Update progress after 2 seconds
  setTimeout(() => {
    updateDownloadProgress('Preparing download...');
  }, 2000);
  
  // Update progress after 5 seconds
  setTimeout(() => {
    updateDownloadProgress('Starting download...');
  }, 5000);
  
  // Hide progress after 30 seconds (download should have started)
  setTimeout(() => {
    hideDownloadProgress();
    try {
      document.body.removeChild(iframe);
    } catch (e) {
      // Ignore if already removed
    }
  }, 30000);
}

/* ── Download Progress Notification ── */
function showDownloadProgress(filename, ext) {
  // Remove existing notification if any
  hideDownloadProgress();
  
  const notification = document.createElement('div');
  notification.id = 'downloadNotification';
  notification.className = 'download-notification';
  notification.innerHTML = `
    <div class="download-notification-content">
      <div class="download-spinner"></div>
      <div class="download-info">
        <div class="download-filename">${filename}.${ext}</div>
        <div class="download-status">Fetching download URL...</div>
      </div>
      <button class="download-close" onclick="hideDownloadProgress()">×</button>
    </div>
  `;
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('show'), 10);
}

function updateDownloadProgress(status) {
  const notification = document.getElementById('downloadNotification');
  if (notification) {
    const statusEl = notification.querySelector('.download-status');
    if (statusEl) statusEl.textContent = status;
  }
}

function hideDownloadProgress() {
  const notification = document.getElementById('downloadNotification');
  if (notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      try {
        document.body.removeChild(notification);
      } catch (e) {
        // Ignore if already removed
      }
    }, 300);
  }
}

/* ── Generic Downloader UI ── */
function initDownloader({ apiPath, platform, extraValidate, filterType }) {
  const urlInput = document.getElementById('urlInput');
  const searchBtn = document.getElementById('searchBtn');
  const resultCard = document.getElementById('resultCard');

  if (!urlInput || !searchBtn) return;

  function showProgress(label) {
    hideEl('resultCard'); hideEl('errorBox');
    showEl('progressWrap');
    setText('progressLabel', label || 'Retrieving media resources…');
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.animation = 'progressAnim 2s ease-in-out infinite';
  }
  function hideProgress() {
    hideEl('progressWrap');
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.animation = 'none';
  }
  function showError(msg) {
    hideProgress(); hideEl('resultCard'); showEl('errorBox');
    setText('errorMsg', msg);
  }

  searchBtn.addEventListener('click', async () => {
    const val = urlInput.value.trim();
    if (!val) {
      urlInput.focus();
      urlInput.classList.add('shake');
      setTimeout(() => urlInput.classList.remove('shake'), 500);
      return;
    }
    if (extraValidate && !extraValidate(val)) {
      showError(`Please enter a valid ${platform} URL`);
      return;
    }
    showProgress();
    searchBtn.disabled = true;
    searchBtn.style.opacity = '0.7';
    try {
      const res = await fetch(`${apiPath}?url=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Failed to retrieve video.'); return; }
      hideProgress();
      hideEl('errorBox');
      renderResult(data, val);
    } catch (e) {
      showError('Network error. Please check your connection and try again.');
    } finally {
      searchBtn.disabled = false;
      searchBtn.style.opacity = '1';
    }
  });

  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchBtn.click(); });
  urlInput.addEventListener('input', () => hideEl('errorBox'));

  function renderResult(data, originalUrl) {
    const { videoDetails, formats } = data;
    
    // Set thumbnail
    const thumb = document.getElementById('resultThumb');
    if (thumb && videoDetails.thumbnail) {
      thumb.src = videoDetails.thumbnail;
      thumb.alt = videoDetails.title;
    } else if (thumb) {
      thumb.style.display = 'none';
    }
    
    setText('resultTitle', videoDetails.title || 'Untitled Video');
    setText('resultAuthor', videoDetails.author || '');
    if (videoDetails.duration) setText('resultDuration', fmtDuration(videoDetails.duration));

    const grid = document.getElementById('formatsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Filter formats if needed (e.g., mp3 page shows only audio, mp4 shows only video)
    let filtered = formats;
    if (filterType === 'audio') {
      filtered = formats.filter(f => f.type === 'audio');
    } else if (filterType === 'video') {
      filtered = formats.filter(f => f.type === 'video' || f.type === 'video-only');
    }
    // If filter results in nothing, show all
    if (filtered.length === 0) filtered = formats;

    // Deduplicate
    const seen = new Set();
    filtered.forEach(fmt => {
      const key = `${fmt.quality}-${fmt.container}`;
      if (seen.has(key)) return;
      seen.add(key);

      const btn = document.createElement('button');
      btn.className = 'format-btn' + (fmt.type === 'audio' ? ' audio' : '');
      const size = fmtBytes(fmt.contentLength);
      const isAudio = fmt.type === 'audio';
      const displayQuality = formatQualityLabel(fmt.quality);
      const noAudio = fmt.type === 'video-only' ? ' 🔇' : '';
      
      btn.innerHTML = isAudio
        ? `<span class="fmt-icon">🎵</span><span class="fmt-label">MP3 ${displayQuality}</span>${size ? `<span class="fmt-size">${size}</span>` : ''}`
        : `<span class="fmt-icon">⬇</span><span class="fmt-label">${displayQuality} ${(fmt.container || 'mp4').toUpperCase()}${noAudio}</span>${size ? `<span class="fmt-size">${size}</span>` : ''}`;
      
      btn.title = `Download ${displayQuality} ${fmt.container || 'mp4'}${noAudio}`;

      btn.addEventListener('click', () => {
        // Add download animation
        btn.classList.add('downloading');
        btn.innerHTML = `<span class="fmt-icon">⏳</span><span class="fmt-label">Starting download...</span>`;
        setTimeout(() => {
          btn.classList.remove('downloading');
          btn.innerHTML = isAudio
            ? `<span class="fmt-icon">🎵</span><span class="fmt-label">MP3 ${displayQuality}</span>${size ? `<span class="fmt-size">${size}</span>` : ''}`
            : `<span class="fmt-icon">⬇</span><span class="fmt-label">${displayQuality} ${(fmt.container || 'mp4').toUpperCase()}</span>${size ? `<span class="fmt-size">${size}</span>` : ''}`;
        }, 3000);

        const forceExt = isAudio ? 'mp3' : (fmt.container || 'mp4');
        const safeName = (videoDetails.title || 'video').replace(/[^\w\s-]/g, '').trim().slice(0, 100);

        // All platforms go through unified /api/download using original URL + yt-dlp piping
        const dlUrl = `/api/download?url=${encodeURIComponent(originalUrl)}&quality=${fmt.height || fmt.quality || ''}&itag=${fmt.itag || ''}&title=${encodeURIComponent(videoDetails.title)}&ext=${forceExt}`;
        triggerInstantDownload(dlUrl, safeName, forceExt);
      });

      grid.appendChild(btn);
    });

    if (grid.children.length === 0) {
      grid.innerHTML = '<p style="color:var(--text2);font-size:.85rem">No downloadable formats found for this content.</p>';
    }

    showEl('resultCard');
    if (resultCard) resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* ── Scroll Reveal Animation ── */
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.step-card,.feature-card,.faq-item,.platform-card,.related-card,.article-block,.stat-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    obs.observe(el);
  });
}

/* ── FAQ Accordion ── */
function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const qBtn = item.querySelector('.faq-q');
    if (!qBtn) return;
    qBtn.addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        const b = i.querySelector('.faq-q');
        if (b) b.setAttribute('aria-expanded', false);
      });
      if (!open) {
        item.classList.add('open');
        qBtn.setAttribute('aria-expanded', true);
      }
    });
  });
}

/* ── Smooth Scroll CTA ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href="#hero"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const hero = document.getElementById('hero');
      if (hero) {
        hero.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          const input = document.getElementById('urlInput');
          if (input) input.focus();
        }, 600);
      }
    });
  });
}

/* ── Contact Form Handler ── */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('contactSubmit');
    if (submitBtn) {
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
    }
    try {
      const formData = {
        name: document.getElementById('contactName')?.value || '',
        email: document.getElementById('contactEmail')?.value || '',
        subject: document.getElementById('contactSubject')?.value || '',
        message: document.getElementById('contactMessage')?.value || '',
      };
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      form.style.display = 'none';
      const success = document.getElementById('formSuccess');
      if (success) success.style.display = 'block';
    } catch (err) {
      form.style.display = 'none';
      const success = document.getElementById('formSuccess');
      if (success) success.style.display = 'block';
    }
  });
}
