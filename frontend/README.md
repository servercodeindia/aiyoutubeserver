# YouTubeServer Frontend

Static frontend for YouTubeServer - Multi-platform video downloader.

## 🚀 Deployment on Netlify

### Quick Deploy
1. Push this `frontend` folder to GitHub
2. Connect to Netlify
3. Netlify will auto-detect `netlify.toml` configuration
4. Deploy!

### Manual Configuration
- **Build Command:** (leave empty - static site)
- **Publish Directory:** `public`
- **Environment Variables:** None needed

### Custom Domain
1. Go to Netlify Dashboard → Domain Settings
2. Add custom domain: `youtubeserver.com`
3. Configure DNS:
   - Type: A Record
   - Name: @
   - Value: (Netlify's IP)
   - Type: CNAME
   - Name: www
   - Value: (your-site).netlify.app

## 🔗 Backend Connection

Frontend connects to backend API at:
```
https://youtubeserver-backend.onrender.com
```

All `/api/*` requests are automatically proxied to the backend.

## 📁 Structure

```
frontend/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── shared.js
│   │   ├── translations.js
│   │   └── page-downloader.js
│   ├── index.html
│   └── ... (other pages)
├── netlify.toml
├── _redirects
└── README.md
```

## 🌐 Features

- ✅ Static site hosting (fast CDN)
- ✅ Automatic HTTPS
- ✅ Global CDN distribution
- ✅ API proxy to backend
- ✅ SPA routing support
- ✅ Security headers
- ✅ Asset caching
- ✅ Gzip compression

## 🔧 Local Development

1. Install a local server:
```bash
npm install -g http-server
```

2. Run the server:
```bash
cd frontend/public
http-server -p 3000
```

3. Open: http://localhost:3000

**Note:** API calls will go to production backend. For local backend testing, update the API URLs in JavaScript files.

## 📝 Environment-Specific Configuration

### Production (Netlify)
- API Base URL: Proxied via `netlify.toml`
- All `/api/*` → `https://youtubeserver-backend.onrender.com/api/*`

### Development (Local)
- Update `API_BASE` in `public/js/app.js`:
```javascript
const API_BASE = 'http://localhost:3001'; // Local backend
```

## 🚀 Performance

- **CDN:** Global edge network
- **Cache:** Static assets cached for 1 year
- **Compression:** Gzip enabled
- **HTTP/2:** Enabled by default
- **SSL:** Free automatic HTTPS

## 📊 Analytics

Add analytics by including script in `public/index.html`:

### Google Analytics
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
```

### Netlify Analytics
Enable in Netlify Dashboard → Analytics

## 🔒 Security

- X-Frame-Options: DENY
- X-XSS-Protection: Enabled
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: Restricted

## 📱 Supported Platforms

- YouTube
- Facebook
- Instagram
- Twitter/X
- TikTok

## 🌍 Multi-Language Support

- English
- Español
- Français
- Deutsch
- Português
- हिन्दी
- العربية

## 📞 Support

- Instagram: [@network.tsx](https://instagram.com/network.tsx)
- Website: [youtubeserver.com](https://youtubeserver.com)

## 📄 License

All rights reserved © 2026 YouTubeServer
