/* ===================================================
   Universal Downloader Module
   Instant downloads for all platforms (YouTube, Facebook, Instagram, Twitter, TikTok)
   No popups, no delays, direct streaming
   =================================================== */

const API_BASE = '';

// ── State tracking ──
let isDownloading = false;

/* ── Core Download Function (Backend Streaming - No New Tab) ── */
function triggerInstantDownload(url, filename, ext = 'mp4') {
  // Use fetch to trigger backend download without opening new tab
  const startTime = Date.now();
  
  fetch(url, {
    headers: {
      'Accept': '*/*',
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
      // Log download speed
      const elapsed = Date.now() - startTime;
      console.log(`⚡ Download initiated: ${elapsed}ms`);
      return response.blob();
    })
    .then(blob => {
      // Create blob URL and trigger download in same tab
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
      
      isDownloading = false;
    })
    .catch(error => {
      console.error('Download error:', error);
      isDownloading = false;
      alert(`Download failed: ${error.message}`);
    });
}

/* ── Universal Platform Downloader ── */
async function downloadMedia(mediaUrl, title = 'download', ext = 'mp4', format = {}, platform = 'unknown') {
  if (isDownloading) return;
  isDownloading = true;

  try {
    // Build download URL with all parameters
    let downloadUrl = `${API_BASE}/api/download?`;
    downloadUrl += `url=${encodeURIComponent(mediaUrl)}`;
    downloadUrl += `&title=${encodeURIComponent(title)}`;
    downloadUrl += `&ext=${ext}`;
    
    // Add platform-specific parameters
    if (format.itag) downloadUrl += `&itag=${format.itag}`;
    if (format.quality) downloadUrl += `&quality=${format.quality}`;
    if (format.height) downloadUrl += `&height=${format.height}`;
    
    // Sanitize filename
    const sanitized = (title || 'media').replace(/[^\w\s-]/g, '').trim().slice(0, 100);
    
    // Instant download - direct stream
    triggerInstantDownload(downloadUrl, sanitized, ext);
    
  } catch (error) {
    console.error('Download error:', error);
    alert('Download failed. Please try again.');
  } finally {
    // Reset after a delay
    setTimeout(() => { isDownloading = false; }, 1000);
  }
}

/* ── Format Button Handler ── */
function createFormatButton(fmt, videoTitle, platform = 'youtube') {
  const btn = document.createElement('button');
  const isAudio = fmt.type === 'audio';
  btn.className = 'format-btn' + (isAudio ? ' audio' : '');
  
  const sizeStr = fmtBytes(fmt.contentLength);
  const displayQuality = formatQualityLabel(fmt.quality);
  
  btn.innerHTML = isAudio
    ? `<span class="fmt-icon">🎵</span><span class="fmt-label">${(fmt.container || 'mp3').toUpperCase()} ${displayQuality}</span>${sizeStr ? `<span class="fmt-size">${sizeStr}</span>` : ''}`
    : `<span class="fmt-icon">⬇</span><span class="fmt-label">${displayQuality} ${(fmt.container || 'mp4').toUpperCase()}</span>${sizeStr ? `<span class="fmt-size">${sizeStr}</span>` : ''}`;
  
  btn.title = `Download ${displayQuality} ${fmt.container || 'mp4'}`;
  
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Visual feedback
    const origHTML = btn.innerHTML;
    btn.classList.add('downloading');
    btn.disabled = true;
    btn.innerHTML = `<span class="fmt-icon">⏳</span><span class="fmt-label">Downloading...</span>`;
    
    try {
      const ext = isAudio ? (fmt.container || 'mp3') : (fmt.container || 'mp4');
      
      // Use unified /api/download endpoint for all platforms (yt-dlp handles all)
      const videoUrl = window.currentVideoUrl || '';
      let downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(videoUrl)}`;
      downloadUrl += `&title=${encodeURIComponent(videoTitle)}`;
      downloadUrl += `&ext=${ext}`;
      
      // Add format-specific parameters for quality/format selection
      if (fmt.height) downloadUrl += `&quality=${fmt.height}`;
      if (fmt.itag) downloadUrl += `&itag=${fmt.itag}`;
      
      // Instant download - backend streaming
      triggerInstantDownload(downloadUrl, videoTitle.replace(/[^\w\s-]/g, '').trim().slice(0, 100), ext);
      
      // Keep button in downloading state for 3 seconds
      setTimeout(() => {
        btn.classList.remove('downloading');
        btn.disabled = false;
        btn.innerHTML = origHTML;
      }, 3000);
    } catch (error) {
      console.error('Download error:', error);
      btn.classList.remove('downloading');
      btn.disabled = false;
      btn.innerHTML = origHTML;
      alert('Download failed. Please try again.');
    }
  });
  
  return btn;
}

/* ── Result Display Handler ── */
function displayDownloadResults(data, detectedPlatform = 'youtube') {
  const resultCard = document.getElementById('resultCard');
  const formatsGrid = document.getElementById('formatsGrid');
  const resultThumb = document.getElementById('resultThumb');
  const resultTitle = document.getElementById('resultTitle');
  const resultAuthor = document.getElementById('resultAuthor');
  const resultDur = document.getElementById('resultDuration');
  const errorBox = document.getElementById('errorBox');
  const progressWrap = document.getElementById('progressWrap');

  if (!resultCard || !formatsGrid) return;

  // Hide progress and error
  if (progressWrap) progressWrap.style.display = 'none';
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
  formatsGrid.innerHTML = '';

  const seen = new Set();
  if (formats && formats.length > 0) {
    formats.forEach(fmt => {
      const key = `${fmt.quality}-${fmt.container}`;
      if (seen.has(key)) return;
      seen.add(key);

      const btn = createFormatButton(fmt, videoDetails.title, detectedPlatform);
      
      // Store original URL for later use
      window.currentVideoUrl = videoDetails.originalUrl || window.currentVideoUrl;
      
      formatsGrid.appendChild(btn);
    });
  }

  if (formatsGrid.children.length === 0) {
    formatsGrid.innerHTML = '<p style="color:var(--text2);font-size:.85rem">No downloadable formats found.</p>';
  }

  // Show result card
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Show Loading State ── */
function showDownloadProgress(message = 'Processing...') {
  const progressWrap = document.getElementById('progressWrap');
  const progressLbl = document.getElementById('progressLabel');
  const resultCard = document.getElementById('resultCard');
  const errorBox = document.getElementById('errorBox');

  if (progressWrap) progressWrap.style.display = 'block';
  if (progressLbl) progressLbl.textContent = message;
  if (resultCard) resultCard.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
}

/* ── Show Error State ── */
function showDownloadError(message = 'An error occurred') {
  const errorBox = document.getElementById('errorBox');
  const errorMsg = document.getElementById('errorMsg');
  const progressWrap = document.getElementById('progressWrap');
  const resultCard = document.getElementById('resultCard');

  if (progressWrap) progressWrap.style.display = 'none';
  if (errorBox) {
    errorBox.style.display = 'block';
    if (errorMsg) errorMsg.textContent = message;
  }
  if (resultCard) resultCard.style.display = 'none';
}

/* ── Format helpers (from shared.js) ── */
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

/* ── Platform Detection ── */
function detectPlatform(url) {
  const u = url.toLowerCase().trim();
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/facebook\.com|fb\.watch|fb\.com/.test(u)) return 'facebook';
  if (/instagram\.com/.test(u)) return 'instagram';
  if (/twitter\.com|x\.com/.test(u)) return 'twitter';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  return null;
}
