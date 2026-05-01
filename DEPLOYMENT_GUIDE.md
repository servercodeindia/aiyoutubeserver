# YouTubeServer Deployment Guide
## Netlify (Frontend) + Render (Backend)

Complete guide to deploy YouTubeServer with separated frontend and backend for production use.

---

## 📋 Prerequisites

- GitHub account
- Netlify account (free)
- Render account (free)
- Custom domain (optional)

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Users → Netlify CDN (Frontend) → Render API (Backend) │
│                                                         │
└─────────────────────────────────────────────────────────┘

Frontend (Netlify):
- Static HTML/CSS/JS
- Global CDN
- Automatic HTTPS
- API proxy to backend

Backend (Render):
- Node.js/Express API
- yt-dlp integration
- Video processing
- Download handling
```

---

## 🚀 Part 1: Deploy Backend to Render

### Step 1: Prepare Backend Repository

1. Create a new GitHub repository: `youtubeserver-backend`

2. Push the `backend` folder:
```bash
cd backend
git init
git add .
git commit -m "Initial backend commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/youtubeserver-backend.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com)

2. Click **"New +"** → **"Web Service"**

3. Connect your GitHub repository: `youtubeserver-backend`

4. Configure the service:
   ```
   Name: youtubeserver-backend
   Environment: Node
   Region: Oregon (or closest to your users)
   Branch: main
   Build Command: npm install
   Start Command: node server.js
   Plan: Free (or Starter for better performance)
   ```

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   FRONTEND_URL=https://youtubeserver.netlify.app
   ```

6. Click **"Create Web Service"**

7. Wait for deployment (5-10 minutes)

8. Note your backend URL: `https://youtubeserver-backend.onrender.com`

### Step 3: Test Backend

Test the health endpoint:
```bash
curl https://youtubeserver-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-02T10:30:00.000Z",
  "uptime": 120,
  "memory": {...},
  "cache": {"size": 0, "maxSize": 100}
}
```

---

## 🌐 Part 2: Deploy Frontend to Netlify

### Step 1: Prepare Frontend Repository

1. Create a new GitHub repository: `youtubeserver-frontend`

2. Update `frontend/netlify.toml` with your backend URL:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://youtubeserver-backend.onrender.com/api/:splat"
  status = 200
  force = true
```

3. Update `frontend/_redirects`:
```
/api/*  https://youtubeserver-backend.onrender.com/api/:splat  200
/*      /index.html                                              200
```

4. Push the `frontend` folder:
```bash
cd frontend
git init
git add .
git commit -m "Initial frontend commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/youtubeserver-frontend.git
git push -u origin main
```

### Step 2: Deploy on Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com)

2. Click **"Add new site"** → **"Import an existing project"**

3. Connect to GitHub and select: `youtubeserver-frontend`

4. Configure build settings:
   ```
   Base directory: (leave empty)
   Build command: (leave empty - static site)
   Publish directory: public
   ```

5. Click **"Deploy site"**

6. Wait for deployment (1-2 minutes)

7. Note your site URL: `https://random-name-123.netlify.app`

### Step 3: Update Backend CORS

1. Go back to Render Dashboard

2. Update `FRONTEND_URL` environment variable:
   ```
   FRONTEND_URL=https://random-name-123.netlify.app
   ```

3. Redeploy backend (or it will auto-redeploy)

### Step 4: Test Frontend

1. Visit your Netlify URL: `https://random-name-123.netlify.app`

2. Test video download:
   - Paste a YouTube URL
   - Click Download
   - Select a format
   - Verify download works

---

## 🌍 Part 3: Custom Domain (Optional)

### For Netlify (Frontend)

1. Go to Netlify Dashboard → **Domain Settings**

2. Click **"Add custom domain"**

3. Enter your domain: `youtubeserver.com`

4. Configure DNS at your domain registrar:
   ```
   Type: A
   Name: @
   Value: 75.2.60.5 (Netlify's IP)

   Type: CNAME
   Name: www
   Value: random-name-123.netlify.app
   ```

5. Wait for DNS propagation (5-60 minutes)

6. Netlify will automatically provision SSL certificate

### For Render (Backend)

1. Go to Render Dashboard → **Settings** → **Custom Domain**

2. Add custom domain: `api.youtubeserver.com`

3. Configure DNS:
   ```
   Type: CNAME
   Name: api
   Value: youtubeserver-backend.onrender.com
   ```

4. Update frontend to use custom backend URL:
   ```toml
   # frontend/netlify.toml
   [[redirects]]
     from = "/api/*"
     to = "https://api.youtubeserver.com/api/:splat"
   ```

---

## ⚙️ Part 4: Configuration & Optimization

### Netlify Optimizations

1. **Enable Asset Optimization:**
   - Go to **Build & deploy** → **Post processing**
   - Enable: Bundle CSS, Minify CSS, Minify JS, Compress images

2. **Enable Netlify Analytics:**
   - Go to **Analytics** → Enable (optional, $9/mo)

3. **Configure Headers:**
   Already configured in `netlify.toml`

4. **Set up Redirects:**
   Already configured in `_redirects`

### Render Optimizations

1. **Upgrade Plan (Recommended for production):**
   - Free: Sleeps after 15 min, cold start ~30s
   - Starter ($7/mo): Always on, no cold starts
   - Standard ($25/mo): Better performance, auto-scaling

2. **Enable Auto-Deploy:**
   - Settings → Auto-Deploy: ON

3. **Set up Health Checks:**
   Already configured at `/api/health`

4. **Monitor Performance:**
   - Check Metrics tab regularly
   - Set up alerts for downtime

---

## 🔒 Part 5: Security & Monitoring

### Security Checklist

- [x] HTTPS enabled (automatic on Netlify & Render)
- [x] CORS configured properly
- [x] Security headers set
- [x] Environment variables secured
- [ ] Rate limiting (add express-rate-limit)
- [ ] API authentication (optional)
- [ ] DDoS protection (Cloudflare)

### Monitoring Setup

1. **Google Analytics:**
   Add to `frontend/public/index.html`:
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   ```

2. **Sentry Error Tracking:**
   ```bash
   npm install @sentry/node
   ```
   Add to `backend/server.js`

3. **Uptime Monitoring:**
   - Use UptimeRobot (free)
   - Ping: `https://youtubeserver-backend.onrender.com/api/health`
   - Frequency: Every 5 minutes

---

## 📊 Part 6: Performance Testing

### Test Backend Performance

```bash
# Test health endpoint
curl https://youtubeserver-backend.onrender.com/api/health

# Test YouTube info (should be fast with Innertube API)
curl "https://youtubeserver-backend.onrender.com/api/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Test download endpoint
curl "https://youtubeserver-backend.onrender.com/api/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=720&title=test&ext=mp4" -o test.mp4
```

### Test Frontend Performance

1. **Lighthouse Audit:**
   - Open Chrome DevTools
   - Go to Lighthouse tab
   - Run audit
   - Target: 90+ score

2. **PageSpeed Insights:**
   - Visit: https://pagespeed.web.dev/
   - Enter your Netlify URL
   - Target: 90+ score

---

## 🐛 Troubleshooting

### Issue: Backend not responding
**Solution:**
- Check Render logs
- Verify environment variables
- Test health endpoint
- Check if service is sleeping (free tier)

### Issue: CORS errors
**Solution:**
- Verify FRONTEND_URL in Render matches Netlify URL
- Check browser console for exact error
- Test with curl to isolate issue

### Issue: Downloads not working
**Solution:**
- Check backend logs for yt-dlp errors
- Verify yt-dlp is installed on Render
- Test with different video URLs
- Check if video is region-locked

### Issue: Slow performance
**Solution:**
- Upgrade Render plan (remove cold starts)
- Enable caching
- Use CDN for static assets
- Optimize yt-dlp flags

### Issue: Netlify build fails
**Solution:**
- Check build logs
- Verify `netlify.toml` syntax
- Ensure `public` folder exists
- Check file permissions

---

## 📈 Scaling Strategy

### Current Setup (Free Tier)
- **Capacity:** 100-1,000 users/day
- **Cost:** $0/month
- **Limitations:** Cold starts, limited resources

### Recommended for Production (Paid Tier)
- **Frontend:** Netlify Pro ($19/mo) - Better analytics, more builds
- **Backend:** Render Starter ($7/mo) - Always on, no cold starts
- **Total Cost:** $26/month
- **Capacity:** 10,000-50,000 users/day

### High Traffic Setup
- **Frontend:** Netlify Pro + Cloudflare CDN
- **Backend:** Render Standard ($25/mo) + Redis caching
- **Total Cost:** $50-100/month
- **Capacity:** 100,000+ users/day

---

## ✅ Deployment Checklist

### Backend (Render)
- [ ] Repository created and pushed
- [ ] Service deployed on Render
- [ ] Environment variables set
- [ ] Health check working
- [ ] API endpoints tested
- [ ] CORS configured
- [ ] Custom domain added (optional)

### Frontend (Netlify)
- [ ] Repository created and pushed
- [ ] Site deployed on Netlify
- [ ] API proxy configured
- [ ] Static assets loading
- [ ] Downloads working
- [ ] Custom domain added (optional)
- [ ] SSL certificate active

### Testing
- [ ] Homepage loads
- [ ] Video info retrieval works
- [ ] Downloads work (all platforms)
- [ ] Mobile responsive
- [ ] All pages accessible
- [ ] Forms working (contact)
- [ ] Multi-language working

### Optimization
- [ ] Asset optimization enabled
- [ ] Caching configured
- [ ] Security headers set
- [ ] Analytics added
- [ ] Monitoring set up
- [ ] Error tracking added

---

## 🎉 Success!

Your YouTubeServer is now live with:
- ✅ Frontend on Netlify (global CDN)
- ✅ Backend on Render (scalable API)
- ✅ Automatic HTTPS
- ✅ Separated concerns
- ✅ Production-ready
- ✅ Scalable architecture

**Frontend URL:** https://youtubeserver.netlify.app
**Backend URL:** https://youtubeserver-backend.onrender.com
**Health Check:** https://youtubeserver-backend.onrender.com/api/health

---

## 📞 Support

- Instagram: [@network.tsx](https://instagram.com/network.tsx)
- Documentation: See README files in frontend/ and backend/
- Issues: Create GitHub issues in respective repositories

---

## 📄 License

All rights reserved © 2026 YouTubeServer
