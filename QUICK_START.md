# 🚀 Quick Start Guide

Get YouTubeServer running in production in 15 minutes!

---

## ⚡ Super Quick Deploy (5 Steps)

### 1. Deploy Backend (5 min)
```bash
cd backend
git init
git add .
git commit -m "Backend"
# Push to GitHub
# Connect to Render.com
# Done!
```

### 2. Deploy Frontend (3 min)
```bash
cd frontend
# Update netlify.toml with your Render URL
git init
git add .
git commit -m "Frontend"
# Push to GitHub
# Connect to Netlify.com
# Done!
```

### 3. Update URLs (2 min)
- Update `netlify.toml` → Your Render backend URL
- Update Render env var → Your Netlify frontend URL

### 4. Test (3 min)
- Visit your Netlify URL
- Paste a YouTube URL
- Click Download
- ✅ Success!

### 5. Custom Domain (2 min - Optional)
- Add domain to Netlify
- Add domain to Render
- Update DNS
- Wait for SSL

---

## 📁 What You Have

```
frontend/  → Deploy to Netlify (Static CDN)
backend/   → Deploy to Render (API Server)
```

---

## 🎯 URLs After Deployment

**Frontend:** `https://your-site.netlify.app`
**Backend:** `https://your-backend.onrender.com`
**Health:** `https://your-backend.onrender.com/api/health`

---

## 💰 Cost

**Free Tier:**
- Netlify: Free
- Render: Free (sleeps after 15 min)
- Total: $0/month

**Production:**
- Netlify: Free
- Render Starter: $7/month (always on)
- Total: $7/month

---

## 📚 Full Documentation

- **Deployment:** See `DEPLOYMENT_GUIDE.md`
- **Architecture:** See `ARCHITECTURE.md`
- **Frontend:** See `frontend/README.md`
- **Backend:** See `backend/README.md`

---

## 🆘 Need Help?

1. Check `DEPLOYMENT_GUIDE.md` for detailed instructions
2. Check `ARCHITECTURE.md` for system overview
3. Instagram: [@network.tsx](https://instagram.com/network.tsx)

---

## ✅ Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Netlify
- [ ] URLs updated in both
- [ ] Health check works
- [ ] Site loads
- [ ] Downloads work
- [ ] 🎉 Success!

---

**Time to Production:** 15 minutes
**Cost:** $0-7/month
**Scalability:** Millions of users
**Status:** Production Ready ✅
