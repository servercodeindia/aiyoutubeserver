const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const youtubedl = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://youtubeserver.netlify.app';

// ── In-memory cache for video info (avoids re-running yt-dlp) ──
const INFO_CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100;

function getCachedInfo(url) {
  const entry = INFO_CACHE.get(url);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  if (entry) INFO_CACHE.delete(url);
  return null;
}

function setCachedInfo(url, data) {
  // Evict oldest if over limit
  if (INFO_CACHE.size >= MAX_CACHE_SIZE) {
    const oldest = INFO_CACHE.keys().next().value;
    INFO_CACHE.delete(oldest);
  }
  INFO_CACHE.set(url, { data, ts: Date.now() });
}

// CORS Configuration for separated frontend
const corsOptions = {
  origin: [
    FRONTEND_URL,
    'https://youtubeserver.com',
    'https://www.youtubeserver.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      size: INFO_CACHE.size,
      maxSize: MAX_CACHE_SIZE
    }
  });
});

// ── Helpers ──────────────────────────────────────

// Browsers to try for cookie extraction
const BROWSERS_TO_TRY = ['chrome', 'edge', 'firefox'];

// Cache: remember which browser cookie worked last to skip failures
let lastWorkingBrowser = 'chrome'; // Default to chrome
let browserDetectionDone = false;

// ── FAST: Skip browser detection and cookies on production ──
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  console.log('🚀 Production mode: Skipping browser cookies');
} else {
  console.log('🚀 Fast mode: Using chrome cookies by default');
}
browserDetectionDone = true;

/**
 * ULTRA-FAST yt-dlp call with aggressive optimizations
 * Target: < 2 seconds response time
 */
async function ytdlpFast(url) {
  const cached = getCachedInfo(url);
  if (cached) {
    console.log(`  ⚡ Cache (0ms)`);
    return cached;
  }

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isTikTok = url.includes('tiktok.com');

  // Ultra-minimal flags for maximum speed
  const flags = {
    dumpJson: true,
    skipDownload: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    noPlaylist: true,
    socketTimeout: isTikTok ? 90 : 30,  // TikTok needs more time
    retries: isTikTok ? 5 : 2,
    fragmentRetries: isTikTok ? 5 : 2,
  };
  
  // TikTok-specific configuration - use mobile user agent and proper headers
  if (isTikTok) {
    flags.userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    flags.addHeader = [
      'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language:en-US,en;q=0.9',
      'Accept-Encoding:gzip, deflate, br',
      'Referer:https://www.tiktok.com/',
      'Sec-Fetch-Dest:document',
      'Sec-Fetch-Mode:navigate',
      'Sec-Fetch-Site:none',
      'Upgrade-Insecure-Requests:1',
    ];
    // Force IPv4 to avoid IPv6 connection issues
    flags.forceIpv4 = true;
    // Use extractor args for TikTok
    flags.extractorArgs = 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com';
  }

  // For YouTube: try plain first (no cookies = faster)
  if (isYouTube) {
    try {
      console.log(`  ↳ Fast mode (no cookies)...`);
      const output = await youtubedl(url, flags);
      console.log(`  ✓ Success`);
      setCachedInfo(url, output);
      return output;
    } catch (e) {
      console.log(`  ✗ Plain failed: ${e.message}`);
      
      // Only try cookies in development (not production)
      if (!isProduction) {
        try {
          console.log(`  ↳ With cookies...`);
          const output = await youtubedl(url, { ...flags, cookiesFromBrowser: lastWorkingBrowser });
          console.log(`  ✓ Success`);
          setCachedInfo(url, output);
          return output;
        } catch (e2) {
          console.log(`  ✗ Cookies failed: ${e2.message}`);
          throw new Error(`Could not retrieve video info: ${e2.message}`);
        }
      } else {
        throw new Error(`Could not retrieve video info: ${e.message}`);
      }
    }
  }

  // For TikTok: try multiple approaches with different strategies
  if (isTikTok) {
    // Approach 1: Try without any special flags first (sometimes simpler is better)
    try {
      console.log(`  ↳ TikTok attempt 1 (simple)...`);
      const simpleFlags = {
        dumpJson: true,
        skipDownload: true,
        noWarnings: true,
        noPlaylist: true,
        socketTimeout: 90,
        retries: 5,
      };
      const output = await youtubedl(url, simpleFlags);
      console.log(`  ✓ TikTok Success (simple)`);
      setCachedInfo(url, output);
      return output;
    } catch (e) {
      console.log(`  ✗ TikTok attempt 1 failed: ${e.message}`);
    }

    // Approach 2: Try with geo bypass
    try {
      console.log(`  ↳ TikTok attempt 2 (geo bypass)...`);
      const geoFlags = {
        dumpJson: true,
        skipDownload: true,
        noWarnings: true,
        noPlaylist: true,
        socketTimeout: 90,
        retries: 5,
        geoBypass: true,
        geoBypassCountry: 'US',
      };
      const output = await youtubedl(url, geoFlags);
      console.log(`  ✓ TikTok Success (geo bypass)`);
      setCachedInfo(url, output);
      return output;
    } catch (e) {
      console.log(`  ✗ TikTok attempt 2 failed: ${e.message}`);
    }

    // Approach 3: Try with different user agent
    try {
      console.log(`  ↳ TikTok attempt 3 (desktop UA)...`);
      const desktopFlags = {
        dumpJson: true,
        skipDownload: true,
        noWarnings: true,
        noPlaylist: true,
        socketTimeout: 90,
        retries: 5,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      const output = await youtubedl(url, desktopFlags);
      console.log(`  ✓ TikTok Success (desktop UA)`);
      setCachedInfo(url, output);
      return output;
    } catch (e) {
      console.log(`  ✗ TikTok attempt 3 failed: ${e.message}`);
    }

    // Approach 4: Try with source address (force different network interface)
    try {
      console.log(`  ↳ TikTok attempt 4 (source address)...`);
      const sourceFlags = {
        dumpJson: true,
        skipDownload: true,
        noWarnings: true,
        noPlaylist: true,
        socketTimeout: 90,
        retries: 5,
        sourceAddress: '0.0.0.0',
      };
      const output = await youtubedl(url, sourceFlags);
      console.log(`  ✓ TikTok Success (source address)`);
      setCachedInfo(url, output);
      return output;
    } catch (e) {
      console.log(`  ✗ TikTok attempt 4 failed: ${e.message}`);
      throw new Error(`TikTok is currently blocking downloads from your region. This is a TikTok restriction, not a limitation of our service. Please try again later or use a VPN.`);
    }
  }

  // For other platforms: try without cookies first, then with cookies
  try {
    console.log(`  ↳ Fast mode (no cookies)...`);
    const output = await youtubedl(url, flags);
    console.log(`  ✓ Success`);
    setCachedInfo(url, output);
    return output;
  } catch (e) {
    console.log(`  ✗ Plain failed: ${e.message}`);
    // If plain fails, try with cookies
    try {
      console.log(`  ↳ With cookies...`);
      const output = await youtubedl(url, { ...flags, cookiesFromBrowser: lastWorkingBrowser });
      console.log(`  ✓ Success`);
      setCachedInfo(url, output);
      return output;
    } catch (e2) {
      console.log(`  ✗ Cookies failed: ${e2.message}`);
      throw new Error(`Could not retrieve video info: ${e2.message}`);
    }
  }
}

/**
 * Get the best cookie browser arg for download exec calls.
 */
function getCookieArgsForExec() {
  return { cookiesFromBrowser: lastWorkingBrowser };
}

/**
 * Fallback: get basic video info from YouTube's oEmbed endpoint.
 * This always works without cookies but gives no format/download info.
 */
async function getOembedInfo(url) {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const raw = await fetchUrl(oembedUrl);
  return JSON.parse(raw);
}

// ── YouTube: Extract video ID from any YouTube URL ──
function extractVideoId(url) {
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * ULTRA-FAST YouTube info via Innertube API — ~200-500ms.
 * Direct API call to YouTube's internal endpoint.
 * Bypasses HTML parsing for maximum speed.
 */
async function getYouTubeInfoFast(videoId) {
  try {
    // Method 1: Direct Innertube API call (fastest)
    const apiUrl = 'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    const body = JSON.stringify({
      videoId: videoId,
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240304.00.00',
          hl: 'en',
          gl: 'US',
        }
      }
    });

    const player = await new Promise((resolve, reject) => {
      const req = https.request(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://www.youtube.com',
          'Referer': 'https://www.youtube.com/',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(body);
      req.end();
    });

    if (player.playabilityStatus?.status !== 'OK') {
      const reason = player.playabilityStatus?.reason || 'Video not available';
      throw new Error(reason);
    }

    const vd = player.videoDetails || {};
    const sd = player.streamingData || {};

    // Build format list
    const formats = [];
    const allFormats = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
    
    for (const f of allFormats) {
      if (!f.url) continue;
      
      const mime = f.mimeType || '';
      const isAudio = mime.startsWith('audio/');
      const codecStr = (mime.match(/codecs="([^"]*)"/) || [])[1] || '';
      const codecParts = codecStr.split(',').map(c => c.trim());

      let ext = 'mp4';
      if (mime.includes('webm')) ext = 'webm';
      else if (isAudio && mime.includes('mp4')) ext = 'm4a';

      const dur = parseInt(vd.lengthSeconds) || 0;
      const approxSize = f.contentLength
        ? parseInt(f.contentLength)
        : (f.averageBitrate && dur ? Math.round(f.averageBitrate * dur / 8) : null);

      formats.push({
        format_id: String(f.itag),
        ext,
        height: f.height || null,
        width: f.width || null,
        vcodec: isAudio ? 'none' : (codecParts[0] || 'avc1'),
        acodec: isAudio ? (codecParts[0] || 'mp4a') : (codecParts.length > 1 ? codecParts[1] : 'none'),
        filesize: parseInt(f.contentLength) || null,
        filesize_approx: approxSize,
        url: f.url,
        format_note: f.qualityLabel || (isAudio ? `${Math.round((f.averageBitrate || f.bitrate || 0) / 1000)}kbps` : ''),
        abr: isAudio ? Math.round((f.averageBitrate || f.bitrate || 0) / 1000) : null,
      });
    }

    return {
      id: vd.videoId || videoId,
      title: vd.title || 'Video',
      thumbnail: vd.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      duration: parseInt(vd.lengthSeconds) || 0,
      uploader: vd.author || '',
      view_count: parseInt(vd.viewCount) || 0,
      formats,
    };
  } catch (e) {
    console.log(`  ✗ Innertube API failed: ${e.message}`);
    throw e;
  }
}

// ── YouTube Info (ULTRA-FAST — Direct Innertube API) ──────────
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const startTime = Date.now();

  // Check cache first (instant)
  const cached = getCachedInfo(url);
  if (cached) {
    console.log(`⚡ Cache (0ms)`);
    return res.json(cached);
  }

  let output = null;

  try {
    // Extract video ID and use fast Innertube API
    const videoId = extractVideoId(url);
    if (videoId) {
      console.log(`🚀 Using fast Innertube API for video: ${videoId}`);
      try {
        output = await getYouTubeInfoFast(videoId);
        const elapsed = Date.now() - startTime;
        console.log(`⚡ Retrieved in ${elapsed}ms (Innertube API)`);
      } catch (innertubeErr) {
        console.log(`  ✗ Innertube API failed: ${innertubeErr.message}`);
        console.log(`  ↳ Falling back to yt-dlp...`);
        output = await ytdlpFast(url);
        const elapsed = Date.now() - startTime;
        console.log(`🚀 Retrieved in ${elapsed}ms (yt-dlp fallback)`);
      }
    } else {
      // Fallback to yt-dlp for non-standard URLs
      console.log(`⚠️ Fallback to yt-dlp for URL: ${url}`);
      output = await ytdlpFast(url);
      const elapsed = Date.now() - startTime;
      console.log(`🚀 Retrieved in ${elapsed}ms (yt-dlp)`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({
      error: 'Failed to retrieve video info. The video may be private or unavailable.',
    });
  }

  // ── Build response ──
  const videoDetails = {
    videoId: output.id,
    title: output.title || 'Video',
    thumbnail: output.thumbnail || '',
    duration: output.duration || '',
    author: output.uploader || output.channel || output.author || '',
    viewCount: output.view_count || '',
    originalUrl: url,
  };

  const formats = [];
  const videoFormats = new Map(); // height -> {itag, size, ext, hasAudio}
  const audioFormats = [];

  // Process formats
  (output.formats || []).forEach(f => {
    const isAudio = f.vcodec === 'none' && f.acodec !== 'none';
    const isVideo = f.vcodec !== 'none';
    const size = f.filesize || f.filesize_approx || 0;

    if (isVideo && f.height) {
      const hasAudio = f.acodec !== 'none';
      const existing = videoFormats.get(f.height);
      
      // Prefer formats with audio (instant download)
      if (!existing || (hasAudio && !existing.hasAudio) || (hasAudio === existing.hasAudio && size > existing.size)) {
        videoFormats.set(f.height, {
          itag: f.format_id,
          size: size,
          ext: f.ext || 'mp4',
          hasAudio: hasAudio,
        });
      }
    } else if (isAudio) {
      audioFormats.push({
        itag: f.format_id,
        ext: f.ext || 'm4a',
        abr: f.abr || 0,
        size: size,
      });
    }
  });

  // Build video format list (sorted by quality)
  const sortedHeights = [...videoFormats.keys()].sort((a, b) => b - a);
  sortedHeights.forEach(h => {
    const fmt = videoFormats.get(h);
    const label = h >= 4320 ? '8K' : h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}p`;
    
    formats.push({
      quality: label,
      height: h,
      itag: fmt.itag,
      container: fmt.ext,
      contentLength: fmt.size,
      type: 'video',
    });
  });

  // Add best audio format
  const bestAudio = audioFormats
    .filter(f => f.ext === 'm4a')
    .sort((a, b) => b.abr - a.abr)[0] || audioFormats.sort((a, b) => b.abr - a.abr)[0];
  
  if (bestAudio) {
    formats.push({
      quality: bestAudio.abr ? `${Math.round(bestAudio.abr)}kbps` : 'Audio',
      container: 'mp3',
      itag: bestAudio.itag,
      contentLength: bestAudio.size,
      type: 'audio',
    });
  }

  const result = { videoDetails, formats };
  setCachedInfo(url, result);
  
  const totalTime = Date.now() - startTime;
  console.log(`✅ ${formats.length} formats | ${totalTime}ms`);
  
  res.json(result);
});

// ── Universal Download (proxy with proper headers) ──────────
app.get('/api/download', async (req, res) => {
  const { url, itag, quality, title, ext } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  console.log(`📥 Download request: ${title || 'video'}.${ext || 'mp4'} (itag: ${itag || 'auto'}, quality: ${quality || 'auto'})`);

  try {
    const sanitized = (title || 'video').replace(/[^\w\s-]/g, '').trim().slice(0, 100);
    const fileExt = ext || 'mp4';
    const isAudio = fileExt === 'mp3' || fileExt === 'm4a';

    // Build format string — SIMPLIFIED for reliability
    let formatStr;
    if (isAudio) {
      formatStr = 'bestaudio[ext=m4a]/bestaudio/best';
    } else {
      if (quality) {
        const h = parseInt(quality) || 720;
        formatStr = `best[height<=${h}][ext=mp4][acodec!=none]/best[height<=${h}][acodec!=none]/best[height<=${h}]/best`;
      } else {
        formatStr = 'best[ext=mp4][acodec!=none]/best[acodec!=none]/best';
      }
    }

    console.log(`  ↳ Format: ${formatStr}`);
    console.log(`  ↳ Getting direct URL from yt-dlp...`);

    // Get the direct download URL using yt-dlp (fast, no download)
    const dlFlags = {
      dumpJson: true,
      skipDownload: true,
      format: formatStr,
      noWarnings: true,
      noCheckCertificates: true,
      noPlaylist: true,
    };

    // Use cookie file or cached browser for speed
    const cookieArgs = getCookieArgsForExec();
    let info;
    try {
      info = await youtubedl(url, { ...dlFlags, ...cookieArgs });
      console.log(`  ↳ Got direct URL with cookies`);
    } catch (e) {
      info = await youtubedl(url, dlFlags);
      console.log(`  ↳ Got direct URL without cookies`);
    }

    // Extract the direct URL
    const directUrl = info.url || info.formats?.[0]?.url;
    
    if (!directUrl) {
      console.error(`  ✗ No direct URL found`);
      return res.status(500).json({ error: 'Could not get download URL' });
    }

    console.log(`  ✓ Direct URL obtained, proxying download...`);

    // Set download headers
    const contentType = isAudio ? 'audio/mpeg' : (fileExt === 'webm' ? 'video/webm' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}.${fileExt}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');

    // Proxy the download from the direct URL
    const mod = directUrl.startsWith('https') ? https : http;
    const proxyReq = mod.get(directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (proxyRes) => {
      // Forward content length if available
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
        console.log(`  ↳ File size: ${(parseInt(proxyRes.headers['content-length']) / 1024 / 1024).toFixed(2)} MB`);
      }
      
      // Pipe the response
      proxyRes.pipe(res);
      
      proxyRes.on('end', () => {
        console.log(`  ✓ Download complete`);
      });
    });

    proxyReq.on('error', (err) => {
      console.error(`  ✗ Proxy error:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      proxyReq.destroy();
      console.log(`  ⚠ Client disconnected`);
    });

  } catch (err) {
    console.error('  ✗ Download error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed. Please try again.' });
  }
});

// ── Universal Social Media Info Handler ─────────────────
const handleSocialInfo = (platform) => async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  try {
    const output = await ytdlpFast(url);
    const formats = [];
    const seen = new Set();
    
    if (output.formats) {
      // Video formats (prefer pre-merged with audio)
      output.formats.forEach(f => {
        if (f.url && f.vcodec !== 'none' && f.acodec !== 'none' && !f.url.includes('.m3u8')) {
          let quality = 'Video';
          if (f.height) quality = `${f.height}p`;
          else if (f.format_note) quality = f.format_note;
          else if (f.resolution) quality = f.resolution;
          
          if (!seen.has(quality)) {
            seen.add(quality);
            formats.push({
              quality: quality,
              height: f.height || null,
              container: f.ext || 'mp4',
              contentLength: f.filesize || f.filesize_approx || null,
              type: 'video',
              itag: f.format_id
            });
          }
        }
      });

      // Audio format (best available)
      const audioFormats = output.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');
      const bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
      if (bestAudio) {
        formats.push({
          quality: bestAudio.abr ? `${Math.round(bestAudio.abr)}kbps` : 'Audio',
          container: 'mp3',
          contentLength: bestAudio.filesize || bestAudio.filesize_approx || null,
          type: 'audio',
          itag: bestAudio.format_id
        });
      }
    }
    
    if (formats.length === 0 && output.url) {
      formats.push({
        quality: 'HD',
        container: output.ext || 'mp4',
        type: 'video',
        itag: 'best'
      });
    }

    const thumbnailUrl = output.thumbnail || output.thumbnails?.[0]?.url || `https://via.placeholder.com/640x360/1a1a1a/ffffff?text=${platform}+Video`;
    
    res.json({
      videoDetails: {
        title: output.title || `${platform} Video`,
        thumbnail: thumbnailUrl,
        author: output.uploader || output.channel || output.uploader_id || '',
        duration: output.duration || '',
        platform: platform.toLowerCase(),
        originalUrl: url
      },
      formats: formats.reverse()
    });
    
    // Log for debugging
    console.log(`  ✓ ${platform} info: ${formats.length} formats, thumbnail: ${thumbnailUrl.substring(0, 50)}...`);
  } catch (err) {
    console.error(`${platform} error:`, err.message);
    res.status(500).json({ error: `Failed to retrieve ${platform} video. It may be private or unavailable.` });
  }
};

// ── Facebook Video Info ───────────────────────────
app.get('/api/facebook/info', handleSocialInfo('Facebook'));

// ── Facebook Video Download ───────────────────────
app.get('/api/facebook/download', async (req, res) => {
  const { url, quality, title, ext } = req.query;
  if (!url) return res.status(400).json({ error: 'Video URL is required' });
  try {
    const fileExt = ext || 'mp4';
    const sanitized = (title || 'facebook-video').replace(/[^\w\s-]/g, '').trim().slice(0, 100);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}.${fileExt}"`);
    res.setHeader('Content-Type', fileExt === 'mp3' ? 'audio/mpeg' : (fileExt.match(/webm|mp4/)? `video/${fileExt}` : 'video/mp4'));
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    const decodedUrl = decodeURIComponent(url);
    streamUrl(decodedUrl, res, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
      'Referer': 'https://www.facebook.com/'
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
  }
});

// ── Twitter / X Video Info ────────────────────────
app.get('/api/twitter/info', handleSocialInfo('Twitter'));

// ── Twitter Video Download ────────────────────────
app.get('/api/twitter/download', async (req, res) => {
  const { url, title, ext } = req.query;
  if (!url) return res.status(400).json({ error: 'Video URL is required' });
  try {
    const fileExt = ext || 'mp4';
    const sanitized = (title || 'twitter-video').replace(/[^\w\s-]/g, '').trim().slice(0, 100);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}.${fileExt}"`);
    res.setHeader('Content-Type', fileExt === 'mp3' ? 'audio/mpeg' : (fileExt.match(/webm|mp4/)? `video/${fileExt}` : 'video/mp4'));
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    const decodedUrl = decodeURIComponent(url);
    streamUrl(decodedUrl, res, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://twitter.com/'
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
  }
});

// ── Instagram Info ────────────────────────────────
app.get('/api/instagram/info', handleSocialInfo('Instagram'));

// ── Instagram Download ────────────────────────────
app.get('/api/instagram/download', async (req, res) => {
  const { url, title, ext } = req.query;
  if (!url) return res.status(400).json({ error: 'Video URL is required' });
  try {
    const fileExt = ext || 'mp4';
    const sanitized = (title || 'instagram-video').replace(/[^\w\s-]/g, '').trim().slice(0, 100);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}.${fileExt}"`);
    res.setHeader('Content-Type', fileExt === 'mp3' ? 'audio/mpeg' : (fileExt.match(/webm|mp4/)? `video/${fileExt}` : 'video/mp4'));
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    const decodedUrl = decodeURIComponent(url);
    streamUrl(decodedUrl, res, {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://www.instagram.com/'
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
  }
});

// ── TikTok Info ───────────────────────────────────
app.get('/api/tiktok/info', handleSocialInfo('TikTok'));

// ── TikTok Download ───────────────────────────────
app.get('/api/tiktok/download', async (req, res) => {
  const { url, title, ext } = req.query;
  if (!url) return res.status(400).json({ error: 'Video URL is required' });
  try {
    const fileExt = ext || 'mp4';
    const sanitized = (title || 'tiktok-video').replace(/[^\w\s-]/g, '').trim().slice(0, 100);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}.${fileExt}"`);
    res.setHeader('Content-Type', fileExt === 'mp3' ? 'audio/mpeg' : (fileExt.match(/webm|mp4/)? `video/${fileExt}` : 'video/mp4'));
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    const decodedUrl = decodeURIComponent(url);
    streamUrl(decodedUrl, res, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.tiktok.com/'
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
  }
});

// ── Contact Form Handler ──────────────────────────
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  // Log contact form submission (in production, send email or store in DB)
  console.log(`📧 Contact Form: ${name} (${email}) - ${subject}: ${message}`);
  res.json({ success: true, message: 'Thank you! Your message has been received.' });
});

// ── Utility: fetch URL as string (GET) ──────────────────
function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } };
    mod.get(url, opts, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return fetchUrl(r.headers.location, headers).then(resolve).catch(reject);
      }
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── Utility: POST URL as string ──────────────────
function postUrl(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    };
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(opts, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Utility: stream URL to response ──────────────
function streamUrl(url, res, headers = {}) {
  const mod = url.startsWith('https') ? https : http;
  mod.get(url, { headers }, (r) => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      return streamUrl(r.headers.location, res, headers);
    }
    if (r.headers['content-length']) res.setHeader('Content-Length', r.headers['content-length']);
    r.pipe(res);
  }).on('error', () => { if (!res.headersSent) res.status(500).end(); });
}

// ── API-only backend (frontend hosted separately on Netlify) ────────
// All routes are API endpoints under /api/*
// Frontend handles all page routing

app.listen(PORT, () => {
  console.log(`✅ YouTubeServer Backend API running on port ${PORT}`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
