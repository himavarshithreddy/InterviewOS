# Deploying InterviewOS to Digital Ocean Droplet

This guide walks you through deploying InterviewOS (Vite + React frontend + Express + WebSocket backend) on a Digital Ocean Droplet.

## Prerequisites

- Digital Ocean account
- Domain name (optional but recommended)
- Gemini API key
- Git installed locally

---

## Step 1: Create a Droplet

1. Go to [Digital Ocean](https://cloud.digitalocean.com) → **Create** → **Droplets**
2. **Choose an image**: Ubuntu 22.04 LTS
3. **Choose a plan**: Basic plan, $6/mo (1 GB RAM) minimum; **$12/mo (2 GB RAM)** recommended for better performance
4. **Region**: Choose closest to your users
5. **Authentication**: SSH key (recommended) or password
6. **Hostname**: e.g. `interviewos`
7. Click **Create Droplet**

Note your droplet's IP address.

---

## Step 2: Initial Server Setup

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

### Update system and install dependencies

```bash
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx
```

### Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # Should show v20.x
```

### Install PM2 (process manager)

```bash
npm install -g pm2
```

---

## Step 3: Clone and Build the Project

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/InterviewOS.git
cd InterviewOS
```

### Build frontend

```bash
# Install dependencies
npm install

# Build (VITE_GEMINI_API_KEY is baked into frontend - set it)
export VITE_GEMINI_API_KEY=AIzaSyB8yxXb2nhtuZRDjtrAhQJXcF4EmnULhXM
export VITE_MIN_INTERVIEW_DURATION_SECONDS=300
npm run build
```

This creates `dist/` with static files.

### Build and run backend

```bash
cd server
npm install
npm run build
```

### Create server environment file

```bash
nano /var/www/InterviewOS/server/.env
```

Add:

```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
CLIENT_URL=https://yourdomain.com
NODE_ENV=production
```

Replace `yourdomain.com` with your domain or droplet IP (e.g. `http://YOUR_DROPLET_IP` for testing).

### Start backend with PM2

```bash
cd /var/www/InterviewOS/server
pm2 start dist/index.js --name interviewos-api
pm2 save
pm2 startup   # Enable startup on boot
```

---

## Step 4: Configure Nginx

Create Nginx config:

```bash
nano /etc/nginx/sites-available/interviewos
```

Paste (replace `YOUR_DOMAIN` and `YOUR_DROPLET_IP` as needed):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN YOUR_DROPLET_IP;

    # Frontend - static files
    root /var/www/InterviewOS/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Enable and test:

```bash
ln -sf /etc/nginx/sites-available/interviewos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## Step 5: SSL with Let's Encrypt (recommended)

If you have a domain pointing to your droplet:

```bash
certbot --nginx -d yourdomain.com
```

Follow prompts. Certbot will update Nginx for HTTPS.

Update `server/.env`:

```env
CLIENT_URL=https://yourdomain.com
```

Restart the API:

```bash
pm2 restart interviewos-api
```

---

## Step 6: Firewall (optional)

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

---

## Updating the App

```bash
cd /var/www/InterviewOS
git pull
npm install
npm run build

cd server
npm install
npm run build
pm2 restart interviewos-api
```

---

## Environment Variables Summary

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_GEMINI_API_KEY` | Build time (root) | Gemini API for client-side features |
| `VITE_MIN_INTERVIEW_DURATION_SECONDS` | Build time (root) | Min interview duration |
| `GEMINI_API_KEY` | `server/.env` | Gemini API for server |
| `PORT` | `server/.env` | Backend port (3001) |
| `CLIENT_URL` | `server/.env` | CORS origin (e.g. `https://yourdomain.com`) |
| `NODE_ENV` | `server/.env` | `production` |

---

## Troubleshooting

- **502 Bad Gateway**: Backend not running → `pm2 status` and `pm2 logs interviewos-api`
- **WebSocket fails**: Check Nginx `/ws` proxy config and `proxy_read_timeout`
- **CORS errors**: Ensure `CLIENT_URL` in `server/.env` matches your deployed URL
- **API key errors**: Verify both `VITE_GEMINI_API_KEY` (build) and `GEMINI_API_KEY` (server) are set
