const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

// Use standalone yt-dlp binary on production, npm package on dev
const isProduction = process.env.NODE_ENV === 'production';
const ytdlpPath = isProduction ? '/opt/render/project/src/backend/yt-dlp' : 'yt-dlp';

// Custom yt-dlp wrapper for production
async function youtubedl(url, flags) {
  if (!isProduction) {
    // Use npm package in development
    const youtubedlExec = require('yt-dlp-exec');
    return youtubedlExec(url, flags);
  }
  
  // Use standalone binary in production with better flags
  const args = ['--dump-json', '--skip-download', '--no-warnings'];
  
  // Add all flags
  if (flags.noCheckCertificates) args.push('--no-check-certificates');
  if (flags.preferFreeFormats) args.push('--prefer-free-formats');
  if (flags.noPlaylist) args.push('--no-playlist');
  if (flags.socketTimeout) args.push('--socket-timeout', flags.socketTimeout);
  if (flags.retries) args.push('--retries', flags.retries);
  if (flags.fragmentRetries) args.push('--fragment-retries', flags.fragmentRetries);
  if (flags.userAgent) args.push('--user-agent', flags.userAgent);
  if (flags.addHeader) {
    flags.addHeader.forEach(h => args.push('--add-header', h));
  }
  if (flags.geoBypass) args.push('--geo-bypass');
  if (flags.geoBypassCountry) args.push('--geo-bypass-country', flags.geoBypassCountry);
  if (flags.forceIpv4) args.push('--force-ipv4');
  if (flags.extractorArgs) args.push('--extractor-args', flags.extractorArgs);
  if (flags.sourceAddress) args.push('--source-address', flags.sourceAddress);
  if (flags.format) args.push('--format', flags.format);
  
  args.push(url);
  
  const command = `${ytdlpPath} ${args.map(a => {
    // Properly escape arguments with spaces or special characters
    if (typeof a === 'string' && (a.includes(' ') || a.includes('&') || a.includes('|'))) {
      return `"${a.replace(/"/g, '\\"')}"`;
    }
    return a;
  }).join(' ')}`;
  
  try {
    const { stdout } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(error.stderr || error.message);
  }
}

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
    'https://youtubeserver.netlify.app', // Explicit fallback
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
    retries: isTikTok ? 5 : 3,
    fragmentRetries: isTikTok ? 5 : 3,
    // Add headers to avoid bot detection on all platforms
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    addHeader: [
      'Accept-Language:en-US,en;q=0.9',
      'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ],
  };
  
  // Add geo-bypass for YouTube to avoid regional blocks
  if (isYouTube && isProduction) {
    flags.geoBypass = true;
  }
  
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

  // For YouTube: try multiple yt-dlp strategies
  if (isYouTube) {
    const ytStrategies = [
      { name: 'Android', args: 'youtube:player_client=android' },
      { name: 'iOS', args: 'youtube:player_client=ios' },
      { name: 'Web Embedded', args: 'youtube:player_client=web_embedded' },
      { name: 'TV Embedded', args: 'youtube:player_client=tv_embedded' },
    ];

    for (const strat of ytStrategies) {
      try {
        console.log(`  ↳ yt-dlp ${strat.name}...`);
        const output = await youtubedl(url, {
          ...flags,
          extractorArgs: strat.args,
          socketTimeout: 15,
          retries: 2,
        });
        console.log(`  ✓ Success`);
        setCachedInfo(url, output);
        return output;
      } catch (e) {
        console.log(`  ✗ ${strat.name} failed`);
        continue;
      }
    }
    
    throw new Error(`YouTube is blocking this server's IP address. Please try again later or contact support.`);
  }

  // For TikTok: use simple approach (most reliable)
  if (isTikTok) {
    try {
      console.log(`  ↳ TikTok download...`);
      const output = await youtubedl(url, {
        dumpJson: true,
        skipDownload: true,
        noWarnings: true,
        noPlaylist: true,
        socketTimeout: 60,
        retries: 3,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      console.log(`  ✓ TikTok Success`);
      setCachedInfo(url, output);
      return output;
    } catch (e) {
      console.log(`  ✗ TikTok failed: ${e.message}`);
      throw new Error(`TikTok video unavailable. Please try again later.`);
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

/**
 * Get the best cookie browser arg for download exec calls.
 */
function getCookieArgsForExec() {
  // Skip cookies in production
  if (isProduction) {
    return {};
  }
  return { cookiesFromBrowser: lastWorkingBrowser };
}

/**
 * Fallback: Use YouTube Data API v3 (official, requires API key)
 * Free tier: 10,000 quota units/day (about 3,000 video info requests)
 */
async function getYouTubeDataAPIInfo(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`;
  
  const data = await fetchUrl(apiUrl);
  const response = JSON.parse(data);
  
  if (!response.items || response.items.length === 0) {
    throw new Error('Video not found');
  }
  
  const video = response.items[0];
  const snippet = video.snippet;
  const details = video.contentDetails;
  const stats = video.statistics;
  
  // Parse ISO 8601 duration (PT1H2M10S -> seconds)
  const duration = details.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(duration[1] || 0);
  const minutes = parseInt(duration[2] || 0);
  const seconds = parseInt(duration[3] || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  
  return {
    id: videoId,
    title: snippet.title,
    thumbnail: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
    duration: totalSeconds,
    uploader: snippet.channelTitle,
    view_count: parseInt(stats.viewCount || 0),
    formats: [], // API doesn't provide download URLs
  };
}

/**
 * Fallback: Extract video info from YouTube's oEmbed and webpage
 * This works even when API is blocked
 */
async function getYouTubeInfoFallback(videoId) {
  try {
    console.log(`  ↳ Using oEmbed fallback...`);
    
    // Get basic info from oEmbed (always works)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedData = await fetchUrl(oembedUrl);
    const oembed = JSON.parse(oembedData);
    
    // Get additional info from noembed.com (third-party service)
    let duration = 0;
    try {
      const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
      const noembedData = await fetchUrl(noembedUrl);
      const noembed = JSON.parse(noembedData);
      duration = noembed.duration || 0;
    } catch (e) {
      console.log(`  ✗ noembed failed: ${e.message}`);
    }
    
    // Build basic format list (we'll use yt-dlp for actual download)
    const formats = [
      { format_id: '18', ext: 'mp4', height: 360, vcodec: 'avc1', acodec: 'mp4a', format_note: '360p' },
      { format_id: '22', ext: 'mp4', height: 720, vcodec: 'avc1', acodec: 'mp4a', format_note: '720p' },
      { format_id: '137', ext: 'mp4', height: 1080, vcodec: 'avc1', acodec: 'none', format_note: '1080p' },
      { format_id: '140', ext: 'm4a', height: null, vcodec: 'none', acodec: 'mp4a', format_note: '128kbps', abr: 128 },
    ];
    
    console.log(`  ✓ oEmbed fallback success`);
    
    return {
      id: videoId,
      title: oembed.title || 'Video',
      thumbnail: oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      duration: duration,
      uploader: oembed.author_name || '',
      view_count: 0,
      formats,
    };
  } catch (e) {
    console.log(`  ✗ oEmbed fallback failed: ${e.message}`);
    throw new Error('All methods failed - video may be unavailable');
  }
}

/**
 * Simple oEmbed info getter for basic metadata
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
 * Uses multiple client strategies to bypass bot detection.
 */
async function getYouTubeInfoFast(videoId) {
  // Try multiple client types - each has different rate limits
  const strategies = [
    {
      name: 'ANDROID',
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 30,
          hl: 'en',
          gl: 'US',
        }
      },
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
    },
    {
      name: 'IOS',
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '19.09.3',
          deviceModel: 'iPhone14,3',
          hl: 'en',
          gl: 'US',
        }
      },
      userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
    },
    {
      name: 'MWEB',
      context: {
        client: {
          clientName: 'MWEB',
          clientVersion: '2.20240304.08.00',
          hl: 'en',
          gl: 'US',
        }
      },
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    }
  ];

  let lastError = null;

  for (const strategy of strategies) {
    try {
      console.log(`  ↳ Trying ${strategy.name}...`);
      
      const apiUrl = 'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
      const body = JSON.stringify({
        videoId: videoId,
        context: strategy.context,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: 'HTML5_PREF_WANTS'
          }
        }
      });

      const player = await new Promise((resolve, reject) => {
        const req = https.request(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': strategy.userAgent,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
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
          reject(new Error('Timeout'));
        });
        req.write(body);
        req.end();
      });

      if (player.playabilityStatus?.status !== 'OK') {
        const reason = player.playabilityStatus?.reason || 'Unavailable';
        lastError = reason;
        console.log(`  ✗ ${strategy.name}: ${reason}`);
        continue;
      }

      const vd = player.videoDetails || {};
      const sd = player.streamingData || {};

      // Build format list
      const formats = [];
      const allFormats = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
      
      for (const f of allFormats) {
        if (!f.url && !f.signatureCipher && !f.cipher) continue;
        
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
          url: f.url || null,
          format_note: f.qualityLabel || (isAudio ? `${Math.round((f.averageBitrate || f.bitrate || 0) / 1000)}kbps` : ''),
          abr: isAudio ? Math.round((f.averageBitrate || f.bitrate || 0) / 1000) : null,
        });
      }

      console.log(`  ✓ ${strategy.name} success`);

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
      lastError = e.message;
      console.log(`  ✗ ${strategy.name}: ${e.message}`);
      continue;
    }
  }

  throw new Error(lastError || 'All strategies failed');
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
      console.log(`🚀 Fetching video: ${videoId}`);
      
      // Try Innertube API first
      try {
        output = await getYouTubeInfoFast(videoId);
        const elapsed = Date.now() - startTime;
        console.log(`⚡ Retrieved in ${elapsed}ms (Innertube API)`);
      } catch (innertubeErr) {
        console.log(`  ✗ Innertube failed: ${innertubeErr.message}`);
        
        // Fallback to yt-dlp
        console.log(`  ↳ Trying yt-dlp...`);
        try {
          output = await ytdlpFast(url);
          const elapsed = Date.now() - startTime;
          console.log(`🚀 Retrieved in ${elapsed}ms (yt-dlp)`);
        } catch (ytdlpErr) {
          console.log(`  ✗ yt-dlp failed: ${ytdlpErr.message}`);
          
          // Try YouTube Data API v3 if configured
          if (process.env.YOUTUBE_API_KEY) {
            try {
              console.log(`  ↳ Trying YouTube Data API v3...`);
              const apiData = await getYouTubeDataAPIInfo(videoId);
              
              return res.json({
                videoDetails: {
                  videoId: videoId,
                  title: apiData.title,
                  thumbnail: apiData.thumbnail,
                  duration: apiData.duration,
                  author: apiData.uploader,
                  viewCount: apiData.view_count,
                  originalUrl: url,
                },
                formats: [],
                warning: 'Using YouTube Data API. Download functionality is limited. Video info only.'
              });
            } catch (apiErr) {
              console.log(`  ✗ YouTube Data API failed: ${apiErr.message}`);
            }
          }
          
          // Final fallback: Use basic oEmbed for metadata only
          console.log(`  ↳ Using oEmbed fallback...`);
          const oembed = await getOembedInfo(url);
          
          // Return basic info with default formats that yt-dlp can handle during download
          return res.json({
            videoDetails: {
              videoId: videoId,
              title: oembed.title || 'Video',
              thumbnail: oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              duration: '',
              author: oembed.author_name || '',
              viewCount: '',
              originalUrl: url,
            },
            formats: [
              {
                quality: '1080p',
                height: 1080,
                itag: 'best',
                container: 'mp4',
                contentLength: null,
                type: 'video',
              },
              {
                quality: '720p',
                height: 720,
                itag: '720',
                container: 'mp4',
                contentLength: null,
                type: 'video',
              },
              {
                quality: '480p',
                height: 480,
                itag: '480',
                container: 'mp4',
                contentLength: null,
                type: 'video',
              },
              {
                quality: '360p',
                height: 360,
                itag: '360',
                container: 'mp4',
                contentLength: null,
                type: 'video',
              },
              {
                quality: 'Audio',
                container: 'mp3',
                itag: 'audio',
                contentLength: null,
                type: 'audio',
              }
            ],
            warning: 'YouTube is temporarily blocking this server. Using fallback mode. Downloads will be attempted with best available quality.'
          });
        }
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
    
    // Provide helpful error messages
    let errorMsg = 'Failed to retrieve video info.';
    if (err.message.includes('Sign in to confirm')) {
      errorMsg = 'YouTube is blocking requests from this server. This is a temporary issue. Please try again in a few minutes.';
    } else if (err.message.includes('bot')) {
      errorMsg = 'YouTube detected automated access. Please try again later.';
    } else if (err.message.includes('blocking')) {
      errorMsg = err.message;
    } else if (err.message.includes('private')) {
      errorMsg = 'This video is private or unavailable.';
    } else if (err.message.includes('Timeout')) {
      errorMsg = 'Request timed out. The video server may be slow. Please try again.';
    } else {
      errorMsg = `Unable to retrieve video: ${err.message}`;
    }
    
    return res.status(500).json({ error: errorMsg });
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
      // Handle fallback format IDs (best, 720, 480, 360, audio)
      if (itag === 'best' || !quality) {
        formatStr = 'best[ext=mp4][acodec!=none]/best[acodec!=none]/best';
      } else if (itag === 'audio') {
        formatStr = 'bestaudio[ext=m4a]/bestaudio/best';
      } else if (quality) {
        const h = parseInt(quality) || 720;
        formatStr = `best[height<=${h}][ext=mp4][acodec!=none]/best[height<=${h}][acodec!=none]/best[height<=${h}]/best`;
      } else {
        formatStr = 'best[ext=mp4][acodec!=none]/best[acodec!=none]/best';
      }
    }

    console.log(`  ↳ Format: ${formatStr}`);
    console.log(`  ↳ Getting direct URL from yt-dlp...`);

    // Get the direct download URL using yt-dlp with multiple strategies
    const dlFlags = {
      dumpJson: true,
      skipDownload: true,
      format: formatStr,
      noWarnings: true,
      noCheckCertificates: true,
      noPlaylist: true,
      socketTimeout: 20,
      retries: 2,
    };

    let info;
    const strategies = [
      { name: 'Android', args: 'youtube:player_client=android' },
      { name: 'iOS', args: 'youtube:player_client=ios' },
      { name: 'Web Embedded', args: 'youtube:player_client=web_embedded' },
    ];

    // Try multiple strategies
    for (const strat of strategies) {
      try {
        console.log(`  ↳ Trying ${strat.name}...`);
        info = await youtubedl(url, { ...dlFlags, extractorArgs: strat.args });
        console.log(`  ✓ Got URL with ${strat.name}`);
        break;
      } catch (e) {
        console.log(`  ✗ ${strat.name} failed: ${e.message}`);
        if (strat === strategies[strategies.length - 1]) {
          throw new Error('All download strategies failed. YouTube may be blocking this server.');
        }
      }
    }

    if (!info) {
      throw new Error('Failed to get download URL');
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
