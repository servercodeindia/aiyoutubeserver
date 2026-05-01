# YouTubeServer Backend API

Node.js/Express backend API for YouTubeServer - Multi-platform video downloader.

## 🚀 Deployment on Render

### Quick Deploy
1. Push this `backend` folder to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** `youtubeserver-backend`
   - **Environment:** Node
   - **Region:** Oregon (or closest to your users)
   - **Branch:** main
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or upgrade for better performance)

### Environment Variables
Add in Render Dashboard → Environment:

```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://youtubeserver.netlify.app
```

### Health Check
Render will automatically ping: `/api/health`

## 📁 Structure

```
backend/
├── server.js           # Main API server
├── package.json        # Dependencies
├── package-lock.json   # Lock file
├── render.yaml         # Render configuration
└── README.md          # This file
```

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status, uptime, memory usage, cache stats.

### YouTube Video Info
```
GET /api/info?url={youtube_url}
```
Returns video details and available formats.

### Universal Download
```
GET /api/download?url={video_url}&quality={quality}&itag={itag}&title={title}&ext={ext}
```
Downloads video in specified quality and format.

### Social Media Info
```
GET /api/facebook/info?url={facebook_url}
GET /api/instagram/info?url={instagram_url}
GET /api/twitter/info?url={twitter_url}
GET /api/tiktok/info?url={tiktok_url}
```
Returns video details for each platform.

### Social Media Download
```
GET /api/facebook/download?url={url}&title={title}&ext={ext}
GET /api/instagram/download?url={url}&title={title}&ext={ext}
GET /api/twitter/download?url={url}&title={title}&ext={ext}
GET /api/tiktok/download?url={url}&title={title}&ext={ext}
```
Downloads videos from social media platforms.

### Contact Form
```
POST /api/contact
Body: { name, email, subject, message }
```
Handles contact form submissions.

## 🛠️ Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "yt-dlp-exec": "^2.4.8"
}
```

### System Requirements
- **Node.js:** 18.x or higher
- **yt-dlp:** Installed globally or via package
- **Memory:** 512MB minimum (1GB recommended)
- **CPU:** 1 core minimum (2 cores recommended)

## 🔧 Local Development

1. Install dependencies:
```bash
cd backend
npm install
```

2. Install yt-dlp:
```bash
# Windows (with Python)
pip install yt-dlp

# macOS
brew install yt-dlp

# Linux
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

3. Run the server:
```bash
node server.js
```

4. Test health check:
```bash
curl http://localhost:3000/api/health
```

## 🌐 CORS Configuration

Backend accepts requests from:
- `https://youtubeserver.netlify.app` (production frontend)
- `https://youtubeserver.com` (custom domain)
- `http://localhost:3000` (local development)
- `http://localhost:5000` (alternative local port)

## 💾 Caching

- **In-memory cache:** 10 minutes TTL
- **Max cache size:** 100 entries
- **Cache strategy:** LRU (Least Recently Used)
- **Cached data:** Video info responses

## ⚡ Performance

### Speed Optimizations
- **YouTube Innertube API:** 200-500ms response time
- **yt-dlp fallback:** 20-30s for complex videos
- **Caching:** 0ms for cached requests
- **Parallel processing:** Multiple requests handled concurrently

### Scaling
**Free Tier (Render):**
- 512MB RAM
- 0.1 CPU
- Sleeps after 15 min inactivity
- Cold start: ~30 seconds

**Paid Tier (Starter $7/mo):**
- 512MB RAM
- 0.5 CPU
- Always on (no sleep)
- Auto-scaling available

**For High Traffic:**
- Upgrade to Standard ($25/mo): 2GB RAM, 1 CPU
- Enable auto-scaling: 1-10 instances
- Add Redis for distributed caching
- Use CDN for static assets

## 🔒 Security

### Implemented
- ✅ CORS restrictions
- ✅ Input validation
- ✅ Rate limiting (via Render)
- ✅ Health checks
- ✅ Error handling
- ✅ Secure headers

### Recommended Additions
- [ ] API key authentication
- [ ] Request rate limiting (express-rate-limit)
- [ ] IP whitelisting
- [ ] DDoS protection (Cloudflare)
- [ ] Request logging (Winston)
- [ ] Error monitoring (Sentry)

## 📊 Monitoring

### Health Check Response
```json
{
  "status": "ok",
  "timestamp": "2026-05-02T10:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 50000000,
    "heapTotal": 20000000,
    "heapUsed": 15000000
  },
  "cache": {
    "size": 45,
    "maxSize": 100
  }
}
```

### Render Dashboard
- CPU usage
- Memory usage
- Request count
- Response times
- Error rates
- Logs

## 🐛 Troubleshooting

### Issue: yt-dlp not found
**Solution:** Install yt-dlp globally on Render
```bash
# Add to render.yaml build command
buildCommand: "npm install && pip install yt-dlp"
```

### Issue: CORS errors
**Solution:** Check FRONTEND_URL environment variable matches your Netlify URL

### Issue: Slow cold starts
**Solution:** Upgrade to paid plan (no sleep) or implement keep-alive ping

### Issue: Memory errors
**Solution:** 
- Clear cache more frequently
- Reduce MAX_CACHE_SIZE
- Upgrade to larger instance

### Issue: TikTok downloads failing
**Solution:** TikTok blocks automated downloads. This is expected behavior.

## 🔄 Updates

### Updating yt-dlp
```bash
pip install --upgrade yt-dlp
```

### Updating Dependencies
```bash
npm update
```

### Deploying Updates
1. Push to GitHub
2. Render auto-deploys (if enabled)
3. Or manually deploy from Render Dashboard

## 📈 Scaling Strategy

### Phase 1: Free Tier (0-1K users/day)
- Render Free tier
- Single instance
- In-memory cache

### Phase 2: Paid Tier (1K-10K users/day)
- Render Starter ($7/mo)
- Always on
- Optimized caching

### Phase 3: Standard (10K-100K users/day)
- Render Standard ($25/mo)
- 2-3 instances
- Redis caching
- CDN integration

### Phase 4: Enterprise (100K+ users/day)
- Render Pro ($85/mo)
- Auto-scaling (5-10 instances)
- Redis cluster
- Load balancer
- Monitoring & alerts

## 🌍 Supported Platforms

- ✅ YouTube (fast Innertube API)
- ✅ Facebook
- ✅ Instagram
- ✅ Twitter/X
- ⚠️ TikTok (limited due to platform blocking)

## 📞 Support

- Instagram: [@network.tsx](https://instagram.com/network.tsx)
- Website: [youtubeserver.com](https://youtubeserver.com)

## 📄 License

All rights reserved © 2026 YouTubeServer
