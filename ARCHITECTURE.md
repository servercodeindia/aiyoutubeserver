# YouTubeServer Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS (Worldwide)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NETLIFY CDN (Frontend)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Static Files (HTML, CSS, JS, Images)                    │  │
│  │  - Global CDN Distribution                               │  │
│  │  - Automatic HTTPS                                       │  │
│  │  - Asset Caching (1 year)                               │  │
│  │  - Gzip Compression                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ /api/* requests                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Proxy (netlify.toml)                               │  │
│  │  Forwards /api/* → Backend                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RENDER (Backend API)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Node.js/Express Server                                  │  │
│  │  - Video Info Retrieval                                  │  │
│  │  - Download Processing                                   │  │
│  │  - yt-dlp Integration                                    │  │
│  │  - In-memory Caching                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  yt-dlp (Video Extraction)                               │  │
│  │  - YouTube (Innertube API)                               │  │
│  │  - Facebook, Instagram, Twitter, TikTok                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              VIDEO PLATFORMS (YouTube, Facebook, etc.)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow

### Static Page Request
```
User → Netlify CDN → HTML/CSS/JS → User
(< 100ms response time)
```

### Video Info Request
```
User → Netlify → /api/info → Render → yt-dlp → YouTube API → Response
(200-500ms for YouTube Innertube, 20-30s for yt-dlp fallback)
```

### Video Download Request
```
User → Netlify → /api/download → Render → yt-dlp → Video URL → Stream to User
(Depends on video size and user's connection)
```

---

## 📊 Data Flow Diagram

```
┌──────────┐
│  User    │
│  Browser │
└────┬─────┘
     │
     │ 1. Request Page
     ▼
┌─────────────┐
│   Netlify   │
│     CDN     │
└────┬────────┘
     │
     │ 2. Serve Static Files
     ▼
┌──────────┐
│  User    │
│  Browser │
└────┬─────┘
     │
     │ 3. Paste Video URL
     │ 4. Click Download
     ▼
┌─────────────┐
│  Frontend   │
│  JavaScript │
└────┬────────┘
     │
     │ 5. API Request: /api/info?url=...
     ▼
┌─────────────┐
│   Netlify   │
│  API Proxy  │
└────┬────────┘
     │
     │ 6. Forward to Backend
     ▼
┌─────────────┐
│   Render    │
│   Backend   │
└────┬────────┘
     │
     │ 7. Check Cache
     ├─ Hit → Return Cached Data
     │
     │ 8. Miss → Call yt-dlp
     ▼
┌─────────────┐
│   yt-dlp    │
└────┬────────┘
     │
     │ 9. Extract Video Info
     ▼
┌─────────────┐
│  YouTube    │
│  Platform   │
└────┬────────┘
     │
     │ 10. Return Video Data
     ▼
┌─────────────┐
│   Render    │
│   Backend   │
└────┬────────┘
     │
     │ 11. Cache Result
     │ 12. Return JSON
     ▼
┌─────────────┐
│  Frontend   │
│  JavaScript │
└────┬────────┘
     │
     │ 13. Display Formats
     │ 14. User Selects Quality
     │ 15. Request: /api/download
     ▼
┌─────────────┐
│   Backend   │
│   Streams   │
│   Video     │
└────┬────────┘
     │
     │ 16. Download to User
     ▼
┌──────────┐
│  User    │
│  Device  │
└──────────┘
```

---

## 🌐 Network Architecture

```
                    ┌─────────────────┐
                    │   DNS Provider  │
                    │  youtubeserver  │
                    │      .com       │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌───────────────────┐     ┌───────────────────┐
    │  Netlify CDN      │     │  Render API       │
    │  (Frontend)       │     │  (Backend)        │
    │                   │     │                   │
    │  @ → Netlify      │     │  api → Render     │
    │  www → Netlify    │     │                   │
    └───────────────────┘     └───────────────────┘
            │                         │
            │                         │
            ▼                         ▼
    ┌───────────────────┐     ┌───────────────────┐
    │  Edge Locations   │     │  Server Instance  │
    │  (150+ worldwide) │     │  (Oregon/US)      │
    └───────────────────┘     └───────────────────┘
```

---

## 💾 Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    CACHING LAYERS                        │
└─────────────────────────────────────────────────────────┘

Layer 1: Browser Cache
├─ Static Assets (CSS, JS, Images)
├─ Cache Duration: 1 year
└─ Cache-Control: public, max-age=31536000, immutable

Layer 2: Netlify CDN Cache
├─ HTML Pages
├─ Cache Duration: 1 hour
└─ Invalidated on new deployment

Layer 3: Backend In-Memory Cache
├─ Video Info Responses
├─ Cache Duration: 10 minutes
├─ Max Size: 100 entries
└─ Strategy: LRU (Least Recently Used)

Layer 4: yt-dlp Cache (Optional)
├─ Video Metadata
├─ Cache Duration: Varies
└─ Managed by yt-dlp
```

---

## 🔒 Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                       │
└─────────────────────────────────────────────────────────┘

Layer 1: Network Security
├─ HTTPS Everywhere (TLS 1.3)
├─ Automatic SSL Certificates
└─ DDoS Protection (Netlify/Render)

Layer 2: Application Security
├─ CORS Configuration
├─ Security Headers
│   ├─ X-Frame-Options: DENY
│   ├─ X-XSS-Protection: 1; mode=block
│   ├─ X-Content-Type-Options: nosniff
│   └─ Referrer-Policy: strict-origin-when-cross-origin
└─ Input Validation

Layer 3: API Security
├─ Origin Whitelisting
├─ Rate Limiting (Render)
└─ Health Check Monitoring

Layer 4: Data Security
├─ No User Data Storage
├─ No Cookies Required
└─ Temporary Processing Only
```

---

## 📈 Scaling Architecture

### Horizontal Scaling (Render)
```
┌─────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                         │
└────────┬────────────────────────────────┬────────────────┘
         │                                │
         ▼                                ▼
┌─────────────────┐              ┌─────────────────┐
│  Instance 1     │              │  Instance 2     │
│  (Oregon)       │              │  (Oregon)       │
└─────────────────┘              └─────────────────┘
         │                                │
         └────────────┬───────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  Redis Cache  │
              │  (Shared)     │
              └───────────────┘
```

### Geographic Distribution (Netlify)
```
┌─────────────────────────────────────────────────────────┐
│                    GLOBAL CDN                            │
└─────────────────────────────────────────────────────────┘

North America          Europe              Asia Pacific
┌──────────┐      ┌──────────┐      ┌──────────┐
│  US East │      │  London  │      │  Tokyo   │
│  US West │      │  Frankfurt│     │  Sydney  │
│  Canada  │      │  Paris   │      │  Singapore│
└──────────┘      └──────────┘      └──────────┘
     │                  │                  │
     └──────────────────┴──────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Origin Server  │
              │  (Netlify)      │
              └─────────────────┘
```

---

## 🔄 Deployment Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    DEPLOYMENT FLOW                       │
└─────────────────────────────────────────────────────────┘

Frontend Deployment:
Developer → Git Push → GitHub → Netlify Webhook → Build → Deploy → CDN
(1-2 minutes)

Backend Deployment:
Developer → Git Push → GitHub → Render Webhook → Build → Deploy → Live
(5-10 minutes)

Rollback:
Netlify: Instant (previous deployment)
Render: Manual (redeploy previous version)
```

---

## 📊 Monitoring Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MONITORING STACK                      │
└─────────────────────────────────────────────────────────┘

Frontend Monitoring (Netlify):
├─ Analytics Dashboard
├─ Build Logs
├─ Deploy Logs
└─ Performance Metrics

Backend Monitoring (Render):
├─ Health Check (/api/health)
├─ CPU Usage
├─ Memory Usage
├─ Request Count
├─ Response Times
└─ Error Rates

External Monitoring:
├─ UptimeRobot (Uptime)
├─ Google Analytics (Traffic)
├─ Sentry (Errors)
└─ LogRocket (User Sessions)
```

---

## 🎯 Performance Targets

```
┌─────────────────────────────────────────────────────────┐
│                    PERFORMANCE GOALS                     │
└─────────────────────────────────────────────────────────┘

Frontend (Netlify):
├─ First Contentful Paint: < 1s
├─ Time to Interactive: < 2s
├─ Lighthouse Score: > 90
└─ CDN Response Time: < 100ms

Backend (Render):
├─ Health Check: < 100ms
├─ YouTube Info (Innertube): < 500ms
├─ YouTube Info (yt-dlp): < 30s
├─ Download Start: < 5s
└─ API Response Time: < 1s (avg)

Overall:
├─ Uptime: > 99.9%
├─ Error Rate: < 0.1%
└─ User Satisfaction: > 95%
```

---

## 🌍 Geographic Distribution

```
┌─────────────────────────────────────────────────────────┐
│                    GLOBAL PRESENCE                       │
└─────────────────────────────────────────────────────────┘

Frontend (Netlify CDN):
├─ 150+ Edge Locations Worldwide
├─ Automatic Geo-Routing
└─ < 50ms latency to 95% of users

Backend (Render):
├─ Primary: Oregon, US
├─ Optional: Frankfurt, Germany
├─ Optional: Singapore
└─ Choose closest to target audience

Recommendation:
├─ US Users: Oregon
├─ EU Users: Frankfurt
├─ Asia Users: Singapore
└─ Global: Multi-region (paid plans)
```

---

## 📄 Summary

**Architecture Type:** Jamstack (JavaScript, APIs, Markup)

**Frontend:** Static site on global CDN (Netlify)
**Backend:** API server on cloud platform (Render)
**Communication:** HTTPS REST API
**Caching:** Multi-layer (Browser, CDN, Backend)
**Security:** HTTPS, CORS, Headers, Validation
**Scaling:** Independent horizontal scaling
**Deployment:** Automated CI/CD pipelines
**Monitoring:** Multi-tool observability stack

**Result:** Production-ready, scalable, cost-effective architecture for millions of users.
