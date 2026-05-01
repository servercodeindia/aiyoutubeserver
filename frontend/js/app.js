/* ===================================================
   Frontend App (Homepage)
   Universal downloader: YouTube, Facebook, Instagram,
   Twitter/X, TikTok - auto-detects platform from URL
   =================================================== */

const API_BASE = '';

console.log('App.js loading...');

// DOM refs
const urlInput = document.getElementById('urlInput');
const searchBtn = document.getElementById('searchBtn');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressLbl = document.getElementById('progressLabel');
const resultCard = document.getElementById('resultCard');
const resultThumb = document.getElementById('resultThumb');
const resultDur = document.getElementById('resultDuration');
const resultTitle = document.getElementById('resultTitle');
const resultAuthor = document.getElementById('resultAuthor');
const formatsGrid = document.getElementById('formatsGrid');
const errorBox = document.getElementById('errorBox');
const errorMsg = document.getElementById('errorMsg');
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const langBtn = document.getElementById('langBtn');
const langDropdown = document.getElementById('langDropdown');
const faqList = document.getElementById('faqList');
const footerYear = document.getElementById('footerYear');

console.log('Elements found:', { 
  urlInput: !!urlInput, 
  searchBtn: !!searchBtn,
  progressWrap: !!progressWrap,
  resultCard: !!resultCard,
  formatsGrid: !!formatsGrid
});

// Footer year
if (footerYear) footerYear.textContent = new Date().getFullYear();

// Navbar scroll effect
window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// Hamburger menu
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    navLinks.classList.toggle('mobile-open', open);
  });
  navLinks.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('mobile-open');
      hamburger.setAttribute('aria-expanded', false);
    });
  });
}

// Language dropdown
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

// Smooth scroll CTA
document.querySelectorAll('a[href="#hero"]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const hero = document.getElementById('hero');
    if (hero) hero.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { if (urlInput) urlInput.focus(); }, 600);
  });
});

// FAQ Accordion
if (faqList) {
  faqList.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-q');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqList.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        const q = i.querySelector('.faq-q');
        if (q) q.setAttribute('aria-expanded', false);
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', true);
      }
    });
  });
}

// Platform Detection
function detectPlatform(url) {
  const u = url.toLowerCase().trim();
  if (/youtube\.com|youtu\.be/.test(u)) return { platform: 'youtube', apiPath: '/api/info' };
  if (/facebook\.com|fb\.watch|fb\.com/.test(u)) return { platform: 'facebook', apiPath: '/api/facebook/info' };
  if (/instagram\.com/.test(u)) return { platform: 'instagram', apiPath: '/api/instagram/info' };
  if (/twitter\.com|x\.com/.test(u)) return { platform: 'twitter', apiPath: '/api/twitter/info' };
  if (/tiktok\.com/.test(u)) return { platform: 'tiktok', apiPath: '/api/tiktok/info' };
  return null;
}

// Utility: format seconds to mm:ss
function fmtDuration(secs) {
  const s = parseInt(secs, 10);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Utility: format bytes
function fmtBytes(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

// Utility: format quality label
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

// UI state helpers
function showProgress(label = 'Retrieving media resources...') {
  console.log('Showing progress:', label);
  if (resultCard) resultCard.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressLbl) progressLbl.textContent = label;
  if (progressBar) progressBar.style.animation = 'progressAnim 2s ease-in-out infinite';
}

function hideProgress() {
  console.log('Hiding progress');
  if (progressWrap) progressWrap.style.display = 'none';
  if (progressBar) progressBar.style.animation = 'none';
}

function showError(msg) {
  console.log('Showing error:', msg);
  hideProgress();
  if (resultCard) resultCard.style.display = 'none';
  if (errorBox) errorBox.style.display = 'block';
  if (errorMsg) errorMsg.textContent = msg;
}

// Show Result (universal)
function showResult(data, detectedPlatform) {
  console.log('Showing result:', data);
  hideProgress();
  if (errorBox) errorBox.style.display = 'none';

  const { videoDetails, formats } = data;

  if (resultThumb && videoDetails.thumbnail) {
    console.log('Setting thumbnail:', videoDetails.thumbnail);
    resultThumb.src = videoDetails.thumbnail;
    resultThumb.alt = videoDetails.title;
    resultThumb.style.display = '';
    
    // Add error handler for thumbnail loading
    resultThumb.onerror = function() {
      console.log('Thumbnail failed to load, using placeholder');
      // If thumbnail fails to load, use placeholder
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%231a1a1a" width="640" height="360"/%3E%3Ctext fill="%23ffffff" font-family="Arial" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EVideo%3C/text%3E%3C/svg%3E';
      this.onerror = null; // Prevent infinite loop
    };
    
    resultThumb.onload = function() {
      console.log('Thumbnail loaded successfully');
    };
  } else if (resultThumb) {
    console.log('No thumbnail available');
    resultThumb.style.display = 'none';
  }

  if (resultTitle) resultTitle.textContent = videoDetails.title || 'Untitled Video';
  if (resultAuthor) resultAuthor.textContent = videoDetails.author || '';
  if (resultDur) resultDur.textContent = videoDetails.duration ? fmtDuration(videoDetails.duration) : '';

  if (formatsGrid) {
    formatsGrid.innerHTML = '';

    if (!formats || formats.length === 0) {
      formatsGrid.innerHTML = '<p style="color:var(--text2);font-size:.85rem">No downloadable formats found.</p>';
    } else {
      const seen = new Set();
      formats.forEach(fmt => {
        const key = `${fmt.quality}-${fmt.container}`;
        if (seen.has(key)) return;
        seen.add(key);

        const btn = document.createElement('button');
        const isAudio = fmt.type === 'audio';
        btn.className = 'format-btn' + (isAudio ? ' audio' : '');

        const sizeStr = fmtBytes(fmt.contentLength);
        const displayQuality = formatQualityLabel(fmt.quality);

        btn.innerHTML = isAudio
          ? `<span class="fmt-icon">🎵</span><span class="fmt-label">${(fmt.container || 'mp3').toUpperCase()} ${displayQuality}</span>${sizeStr ? `<span class="fmt-size">${sizeStr}</span>` : ''}`
          : `<span class="fmt-icon">⬇</span><span class="fmt-label">${displayQuality} ${(fmt.container || 'mp4').toUpperCase()}</span>${sizeStr ? `<span class="fmt-size">${sizeStr}</span>` : ''}`;

        btn.title = `Download ${displayQuality} ${fmt.container || 'mp4'}`;

        btn.addEventListener('click', () => {
          console.log('Format button clicked:', fmt);
          const origHTML = btn.innerHTML;
          btn.classList.add('downloading');
          btn.innerHTML = `<span class="fmt-icon">⏳</span><span class="fmt-label">Starting download...</span>`;
          setTimeout(() => { btn.classList.remove('downloading'); btn.innerHTML = origHTML; }, 3000);

          const forceExt = isAudio ? (fmt.container || 'mp3') : (fmt.container || 'mp4');
          
          if (videoDetails.originalUrl) {
            const dlUrl = `${API_BASE}/api/download?url=${encodeURIComponent(videoDetails.originalUrl)}&quality=${fmt.height || ''}&itag=${fmt.itag || ''}&title=${encodeURIComponent(videoDetails.title)}&ext=${forceExt}`;
            console.log('Download URL:', dlUrl);
            if (typeof triggerInstantDownload === 'function') {
              triggerInstantDownload(dlUrl, videoDetails.title.replace(/[^\w\s-]/g, '').trim().slice(0, 100), forceExt);
            } else {
              console.error('triggerInstantDownload is not defined!');
              alert('Download function not available. Please refresh the page.');
            }
          } else if (detectedPlatform === 'youtube') {
            const ytUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoDetails.videoId}`);
            const dlUrl = `${API_BASE}/api/download?url=${ytUrl}&quality=${fmt.height || ''}&itag=${fmt.itag || ''}&title=${encodeURIComponent(videoDetails.title)}&ext=${forceExt}`;
            console.log('Download URL:', dlUrl);
            if (typeof triggerInstantDownload === 'function') {
              triggerInstantDownload(dlUrl, videoDetails.title.replace(/[^\w\s-]/g, '').trim().slice(0, 100), forceExt);
            } else {
              console.error('triggerInstantDownload is not defined!');
              alert('Download function not available. Please refresh the page.');
            }
          }
        });

        formatsGrid.appendChild(btn);
      });
    }
  }

  if (resultCard) {
    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Fetch video info (universal)
async function fetchInfo(rawUrl) {
  console.log('Fetching info for:', rawUrl);
  const detected = detectPlatform(rawUrl);
  if (!detected) {
    showError('Unsupported URL. Please enter a YouTube, Facebook, Instagram, Twitter/X, or TikTok URL.');
    return;
  }

  const platformLabels = {
    youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram',
    twitter: 'Twitter/X', tiktok: 'TikTok'
  };

  showProgress(`Retrieving ${platformLabels[detected.platform]} video info... (usually takes 1-3 seconds)`);
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.style.opacity = '0.7';
  }

  const startTime = Date.now();
  let progressInterval;
  
  // Update progress message - TikTok may take longer
  const isTikTok = detected.platform === 'tiktok';
  progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed > 3 && elapsed < 15) {
      showProgress(`Still fetching... (${elapsed}s elapsed)`);
    } else if (elapsed >= 15 && elapsed < 45) {
      showProgress(`${isTikTok ? 'TikTok may take longer...' : 'Taking longer than usual...'} (${elapsed}s elapsed, please wait)`);
    } else if (elapsed >= 45) {
      showProgress(`Almost there... (${elapsed}s elapsed)`);
    }
  }, 3000);

  try {
    const apiUrl = `${API_BASE}${detected.apiPath}?url=${encodeURIComponent(rawUrl)}`;
    console.log('API URL:', apiUrl);
    const res = await fetch(apiUrl);
    const data = await res.json();
    console.log('API Response:', data);

    clearInterval(progressInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`✅ Completed in ${totalTime} seconds`);

    if (!res.ok) {
      showError(data.error || 'Failed to retrieve video info.');
      return;
    }

    showResult(data, detected.platform);

  } catch (err) {
    clearInterval(progressInterval);
    console.error('Fetch error:', err);
    showError('Network error. Please check your connection and try again.');
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.style.opacity = '1';
    }
  }
}

// Validate URL (accepts all platforms)
function isSupportedUrl(str) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com)/i.test(str.trim());
}

// Search button handler
if (searchBtn && urlInput) {
  console.log('Adding event listeners to search button and input');
  
  searchBtn.addEventListener('click', () => {
    console.log('Search button clicked');
    const val = urlInput.value.trim();
    console.log('URL value:', val);
    if (!val) {
      urlInput.focus();
      urlInput.classList.add('shake');
      setTimeout(() => urlInput.classList.remove('shake'), 500);
      return;
    }
    if (!isSupportedUrl(val)) {
      showError('Please enter a valid URL from YouTube, Facebook, Instagram, Twitter/X, or TikTok.');
      return;
    }
    fetchInfo(val);
  });

  // Enter key support
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      console.log('Enter key pressed');
      searchBtn.click();
    }
  });

  // Clear error on new input
  urlInput.addEventListener('input', () => {
    if (errorBox && errorBox.style.display !== 'none') errorBox.style.display = 'none';
  });
} else {
  console.error('Search button or URL input not found!', { searchBtn, urlInput });
}

// Scroll-reveal animation
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.step-card, .feature-card, .faq-item, .platform-card, .related-card, .article-block').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

console.log('App.js loaded successfully');
console.log('triggerInstantDownload available:', typeof triggerInstantDownload);
