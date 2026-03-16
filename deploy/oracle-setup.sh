#!/bin/bash
#
# InterviewOS — One-time Oracle Cloud Instance Setup
# Run this on a fresh Ubuntu 22.04 OCI instance.
#
# Usage:
#   chmod +x oracle-setup.sh
#   ./oracle-setup.sh <GEMINI_API_KEY> <GIT_REPO_URL> [PUBLIC_IP]
#
# Example:
#   ./oracle-setup.sh AIzaSy... https://github.com/you/InterviewOS.git 129.154.x.x

set -euo pipefail

GEMINI_KEY="${1:?Usage: $0 <GEMINI_API_KEY> <GIT_REPO_URL> [PUBLIC_IP]}"
GIT_REPO="${2:?Usage: $0 <GEMINI_API_KEY> <GIT_REPO_URL> [PUBLIC_IP]}"
PUBLIC_IP="${3:-$(curl -s ifconfig.me)}"
APP_DIR="/var/www/InterviewOS"

echo "============================================"
echo " InterviewOS — Oracle Cloud Setup"
echo " Public IP: $PUBLIC_IP"
echo "============================================"

# ── 1. System packages ───────────────────────────
echo "[1/8] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ── 2. Node.js 20 ────────────────────────────────
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo "       Node $(node -v) / npm $(npm -v)"

# ── 3. Nginx ─────────────────────────────────────
echo "[3/8] Installing Nginx..."
sudo apt install -y nginx

# ── 4. PM2 ───────────────────────────────────────
echo "[4/8] Installing PM2..."
sudo npm install -g pm2

# ── 5. OS-level firewall (iptables) ──────────────
echo "[5/8] Opening ports 80 & 443 in iptables..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt install -y iptables-persistent
sudo netfilter-persistent save

# ── 6. Clone & build ─────────────────────────────
echo "[6/8] Cloning repo & building..."
sudo mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
  echo "       $APP_DIR already exists — pulling latest..."
  cd "$APP_DIR" && git pull
else
  sudo git clone "$GIT_REPO" "$APP_DIR"
fi
sudo chown -R "$USER:$USER" "$APP_DIR"
cd "$APP_DIR"

# Frontend
echo "       Building frontend..."
cat > .env << EOF
VITE_GEMINI_API_KEY=$GEMINI_KEY
VITE_MIN_INTERVIEW_DURATION_SECONDS=3
EOF
npm install
npm run build

# Backend
echo "       Building backend..."
cd server
cat > .env << EOF
GEMINI_API_KEY=$GEMINI_KEY
PORT=3001
CLIENT_URL=http://$PUBLIC_IP
NODE_ENV=production
EOF
npm install
npm run build

# ── 7. Nginx config ──────────────────────────────
echo "[7/8] Configuring Nginx..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/interviewos
sudo sed -i "s/YOUR_DOMAIN/$PUBLIC_IP/g"      /etc/nginx/sites-available/interviewos
sudo sed -i "s/YOUR_DROPLET_IP/$PUBLIC_IP/g"   /etc/nginx/sites-available/interviewos
sudo ln -sf /etc/nginx/sites-available/interviewos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx

# ── 8. Start API with PM2 ────────────────────────
echo "[8/8] Starting backend API..."
cd "$APP_DIR/server"
pm2 start dist/index.js --name interviewos-api
pm2 save

# Set PM2 to start on boot
startup_cmd=$(pm2 startup systemd -u "$USER" --hp "$HOME" | grep "sudo" | head -1)
if [ -n "$startup_cmd" ]; then
  eval "$startup_cmd"
fi

# ── Convenience: deploy command ──────────────────
sudo ln -sf "$APP_DIR/deploy/deploy.sh" /usr/local/bin/deploy

echo ""
echo "============================================"
echo " ✅  InterviewOS is live!"
echo ""
echo "  🌐  http://$PUBLIC_IP"
echo "  🔌  API health: http://$PUBLIC_IP/api/health"
echo ""
echo "  Redeploy anytime:  deploy"
echo "  View logs:         pm2 logs interviewos-api"
echo "============================================"
