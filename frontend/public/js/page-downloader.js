/* ===================================================
   Universal Downloader Page Handler
   Used by all individual downloader pages
   Handles YouTube MP3, YouTube MP4, Facebook, Instagram, Twitter, TikTok
   =================================================== */

const API_BASE = '';
const PLATFORM = window.PLATFORM || 'universal'; // Set by each page

// ── DOM Elements ──
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

// ── Navbar & Footer injection ──
if (typeof injectNavbar === 'function') {
  injectNavbar(PLATFORM);
}
if (typeof injectFooter === 'function') {
  injectFooter();
}

// ── Platform Detection ──
function detectPlatform(url) {
  const u = url.toLowerCase().trim();
  if (/youtube\.com|youtu\.be/.test(u)) return { platform: 'youtube', apiPath: '/api/info' };
  if (/facebook\.com|fb\.watch|fb\.com/.test(u)) return { platform: 'facebook', apiPath: '/api/facebook/info' };
  if (/instagram\.com/.test(u)) return { platform: 'instagram', apiPath: '/api/instagram/info' };
  if (/twitter\.com|x\.com/.test(u)) return { platform: 'twitter', apiPath: '/api/twitter/info' };
  if (/tiktok\.com/.test(u)) return { platform: 'tiktok', apiPath: '/api/tiktok/info' };
  return null;
}

// ── Format & Duration Helpers ──
function fmtDuration(secs) {
  const s = parseInt(secs, 10);
  const m = Math.floor(s / 60);
  const r = s % 60;
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

// ── Show/Hide Progress ──
function showProgress(label = 'Processing...') {
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressLbl) progressLbl.textContent = label;
  if (resultCard) resultCard.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
}

function hideProgress() {
  if (progressWrap) progressWrap.style.display = 'none';
}

// ── Show/Hide Error ──
function showError(msg) {
  hideProgress();
  if (resultCard) resultCard.style.display = 'none';
  if (errorBox) {
    errorBox.style.display = 'block';
    if (errorMsg) errorMsg.textContent = msg;
  }
}

// ── Instant Download (Backend Streaming - No New Tab) ──
function triggerInstantDownload(url, filename, ext = 'mp4') {
  // Use fetch to trigger download without opening new tab
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      return response.blob();
    })
    .then(blob => {
      // Create blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename ? `${filename}.${ext}` : `download.${ext}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    })
    .catch(err => {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    });
}

// ── Show Result ──
function showResult(data, platform) {
  hideProgress();
  if (errorBox) errorBox.style.display = 'none';

  const { videoDetails, formats } = data;

  // Set thumbnail
  if (resultThumb && videoDetails.thumbnail) {
    resultThumb.src = videoDetails.thumbnail;
    resultThumb.alt = videoDetails.title;
    resultThumb.style.display = '';
  }

  // Set title, author, duration
  if (resultTitle) resultTitle.textContent = videoDetails.title || 'Untitled';
  if (resultAuthor) resultAuthor.textContent = videoDetails.author || '';
  if (resultDur && videoDetails.duration) resultDur.textContent = fmtDuration(videoDetails.duration);

  // Clear and populate formats
  if (formatsGrid) {
    formatsGrid.innerHTML = '';

    // Filter formats based on platform
    let filteredFormats = formats;
    if (PLATFORM === 'youtube' && window.location.pathname.includes('youtube-to-mp3')) {
      // YouTube to MP3 page: only show audio formats
      filteredFormats = formats.filter(fmt => fmt.type === 'audio');
    }

    const seen = new Set();
    if (filteredFormats && filteredFormats.length > 0) {
      filteredFormats.forEach(fmt => {
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
          const origHTML = btn.innerHTML;
          btn.classList.add('downloading');
          btn.innerHTML = `<span class="fmt-icon">⏳</span><span class="fmt-label">Downloading...</span>`;
          btn.disabled = true;

          setTimeout(() => {
            btn.classList.remove('downloading');
            btn.disabled = false;
            btn.innerHTML = origHTML;
          }, 3000);

          const ext = isAudio ? (fmt.container || 'mp3') : (fmt.container || 'mp4');
          let downloadUrl;
          const origUrl = window.currentVideoUrl || videoDetails.originalUrl || '';

          // All platforms: unified /api/download with yt-dlp piping (no new tab)
          downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(origUrl)}&quality=${fmt.height || ''}&itag=${fmt.itag || ''}&title=${encodeURIComponent(videoDetails.title)}&ext=${ext}`;

          triggerInstantDownload(downloadUrl, videoDetails.title.replace(/[^\w\s-]/g, '').trim().slice(0, 100), ext);
        });

        formatsGrid.appendChild(btn);
      });
    }

    if (formatsGrid.children.length === 0) {
      formatsGrid.innerHTML = '<p style="color:var(--text2);font-size:.85rem">No downloadable formats found.</p>';
    }
  }

  // Show result card
  if (resultCard) {
    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── Fetch Video Info ──
async function fetchInfo(rawUrl) {
  const detected = detectPlatform(rawUrl);
  if (!detected) {
    showError('Unsupported URL. Please enter a valid video URL.');
    return;
  }

  const platformLabels = {
    youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram',
    twitter: 'Twitter/X', tiktok: 'TikTok'
  };

  showProgress(`Retrieving ${platformLabels[detected.platform]} video info...`);
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.style.opacity = '0.7';
  }

  // Store original URL for download use
  window.currentVideoUrl = rawUrl;

  try {
    const res = await fetch(`${API_BASE}${detected.apiPath}?url=${encodeURIComponent(rawUrl)}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Failed to retrieve video info.');
      return;
    }

    showResult(data, detected.platform);
  } catch (err) {
    console.error('Fetch error:', err);
    showError('Network error. Please check your connection and try again.');
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.style.opacity = '1';
    }
  }
}

// ── Validate URL ──
function isSupportedUrl(str) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com)/i.test(str.trim());
}

// ── Search Button Handler ──
if (searchBtn && urlInput) {
  searchBtn.addEventListener('click', () => {
    const val = urlInput.value.trim();
    if (!val) {
      urlInput.focus();
      urlInput.classList.add('shake');
      setTimeout(() => urlInput.classList.remove('shake'), 500);
      return;
    }
    if (!isSupportedUrl(val)) {
      showError('Please enter a valid video URL.');
      return;
    }
    fetchInfo(val);
  });

  // Enter key support
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });

  // Clear error on new input
  urlInput.addEventListener('input', () => {
    if (errorBox && errorBox.style.display !== 'none') errorBox.style.display = 'none';
  });
}

// ── FAQ Accordion ──
const faqList = document.getElementById('faqList');
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

// ── Navbar scroll effect ──
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}
