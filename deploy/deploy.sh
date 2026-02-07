#!/bin/bash
# Deploy script - run on the droplet after initial setup
# Usage: ./deploy.sh [path to InterviewOS, default: /var/www/InterviewOS]

set -e
DIR="${1:-/var/www/InterviewOS}"
cd "$DIR"

echo "Pulling latest code..."
git pull

echo "Building frontend..."
npm install
npm run build

echo "Building backend..."
cd server
npm install
npm run build

echo "Restarting API..."
pm2 restart interviewos-api 2>/dev/null || pm2 start dist/index.js --name interviewos-api

echo "Deploy complete. App available at your configured domain/IP."
