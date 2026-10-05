#!/bin/bash
# 🚀 PEM ZERO-TOUCH DEPLOYMENT (AUTOMATE FRESH)
# Assumes: Project folder copied from Windows with existing .env files
# Target: Debian 11/12, Ubuntu 20.04+

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Get absolute path to this script's directory (Project Root)
PROJECT_ROOT=$(dirname $(readlink -f "$0"))
cd "$PROJECT_ROOT"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root (sudo ./automate_fresh.sh)${NC}"
  exit 1
fi

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}      PEM AUTOMATE FRESH DEPLOYMENT              ${NC}"
echo -e "${BLUE}=================================================${NC}"

# Pre-Check: Disk Space
echo -e "\n${BLUE}[0.1/6] Checking Disk Space...${NC}"
AVAILABLE_SPACE=$(df -m / | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_SPACE" -lt 5000 ]; then
    echo -e "${RED}Warning: Low disk space detected ($AVAILABLE_SPACE MB).${NC}"
    echo "This installation (AI models + libraries) requires ~5GB of free space."
    echo "Please free up some space and try again."
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 0. SYSTEM CLEANUP (PURGE CONFLICTS)
echo -e "\n${BLUE}[0/6] Performing Deep System Cleanup...${NC}"

# Stop and Disable HAProxy (Specific request)
echo "Stopping and Purging HAProxy..."
systemctl stop haproxy 2>/dev/null || true
systemctl disable haproxy 2>/dev/null || true
apt-get purge -y haproxy 2>/dev/null || true

# Stop and Disable any other conflicting proxies or old runs
echo "Cleaning up stale services (Nginx, PM2, PostgreSQL)..."
systemctl stop nginx 2>/dev/null || true
systemctl stop postgresql 2>/dev/null || true
pm2 kill 2>/dev/null || true

# Purge unused packages and clean apt cache
echo "Purging unused packages and clear logs..."
apt-get autoremove -y > /dev/null 2>&1
apt-get autoclean -y > /dev/null 2>&1

# Clear Nginx enabled sites to ensure fresh config
rm -f /etc/nginx/sites-enabled/*

# 1. READ CONFIGURATION FROM EXISTING .ENV
echo -e "\n${BLUE}[1/6] Reading Windows Configuration...${NC}"

if [ ! -f "server/.env" ]; then
    echo -e "${RED}Error: server/.env not found!${NC}"
    echo "Please ensure you copied the entire project folder from Windows."
    exit 1
fi

# Extract DB Password (robust grep/sed)
# Looks for DB_PASS=value, ignoring comments and whitespace
# We use a trick to read existing config so we match the Windows environment exactly
DB_PASS_VALUE=$(grep "^DB_PASS=" server/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
DB_USER_VALUE=$(grep "^DB_USER=" server/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')

echo "Detected Database Configuration:"
echo "   User: ${DB_USER_VALUE}"
echo "   Pass: ${DB_PASS_VALUE:0:3}*****" # Mask output

if [ -z "$DB_PASS_VALUE" ]; then
    echo -e "${RED}Error: Could not extract DB_PASS from server/.env${NC}"
    exit 1
fi

# 2. SYSTEM DEPENDENCIES
echo -e "\n${BLUE}[2/6] Installing System Dependencies...${NC}"

# Clean locks
rm /var/lib/apt/lists/lock >/dev/null 2>&1 || true
rm /var/cache/apt/archives/lock >/dev/null 2>&1 || true
rm /var/lib/dpkg/lock* >/dev/null 2>&1 || true

apt-get update -y
apt-get install -y curl

# Setup Node 20 Source
if [[ $(node -v 2>/dev/null) != v20* ]]; then
    echo "Adding Node.js 20 repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null
fi

# Install EVERYTHING (Quietly)
echo "Installing Apt Packages (Node, PostgreSQL, Nginx, Python, OCR, Libs)..."
apt-get install -y nodejs postgresql postgresql-contrib nginx python3 python3-pip python3-venv libgl1 build-essential git psmisc tesseract-ocr libtesseract-dev libmagic1 poppler-utils > /dev/null 2>&1

# Drivers validation
node -v
npm -v
python3 --version

# Install Global PM2
npm install -g pm2 > /dev/null 2>&1

# 3. DATABASE SETUP (Zero Touch - PostgreSQL)
echo -e "\n${BLUE}[3/6] Configuring PostgreSQL Database (Matching Windows)...${NC}"

# Start and enable PostgreSQL
echo "Starting PostgreSQL service..."
systemctl start postgresql
systemctl enable postgresql

# Configure postgres user password and database
echo "Configuring PostgreSQL user 'postgres' and database..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${DB_PASS_VALUE}';"

# Check if DB exists, if not create it
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='expense_manager'")
if [ "$DB_EXISTS" = "1" ]; then
    echo "✓ Database 'expense_manager' already exists."
else
    echo "Creating database 'expense_manager'..."
    sudo -u postgres psql -c "CREATE DATABASE expense_manager OWNER postgres;"
    echo "✓ Database 'expense_manager' created successfully."
fi

echo "✓ Database configured to match 'server/.env'"

# 3.1 DATA MIGRATION CHECK
echo -e "\n${BLUE}[3.1/6] Checking for Data Migration (full_backup.sql)...${NC}"
if [ -f "full_backup.sql" ]; then
    echo "Found 'full_backup.sql'. Importing data into PostgreSQL..."
    PGPASSWORD="${DB_PASS_VALUE}" psql -h 127.0.0.1 -U postgres -d expense_manager -f full_backup.sql
    echo "✓ Data Imported Successfully!"
else
    echo "No backup file found. Skipping data import."
fi

# 4. BACKEND SETUP
echo -e "\n${BLUE}[4/6] Setting up Backend...${NC}"
cd server
echo "Cleaning old node_modules..."
rm -rf node_modules package-lock.json
echo "Installing backend dependencies (this may take a minute)..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Backend npm install failed!${NC}"
    exit 1
fi
echo "✓ Backend dependencies installed"
cd ..

# 5. FRONTEND BUILD
echo -e "\n${BLUE}[5/6] Building Frontend...${NC}"
cd client
rm -rf node_modules package-lock.json dist
echo "Installing frontend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Frontend npm install failed!${NC}"
    exit 1
fi
npm run build
cd ..

# 6. NGINX & PROCESSES
echo -e "\n${BLUE}[6/6] Finalizing Services...${NC}"

# Python Setup
cd python-extraction-service
echo "Installing Python dependencies (Compact Mode - CPU Only)..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip cache purge
echo "Installing CPU-optimized AI libraries (saves 2GB+ disk space)..."
pip install torch==2.1.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
pip cache purge
if [ $? -eq 0 ]; then
    echo "✓ Python dependencies installed in venv"
else
    echo -e "${RED}Warning: Python dependency install had issues.${NC}"
fi
deactivate
cd ..

# Nginx - Max Performance Configuration
cat > /etc/nginx/sites-available/default <<NGINXEOF
server {
    listen 80;
    server_name _;
    root $PROJECT_ROOT/client/dist;
    index index.html;

    # --- ADVANCED PERFORMANCE SETTINGS ---
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Open File Cache
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    # --- COMPRESSION ---
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/rss+xml
        font/truetype
        font/opentype
        application/vnd.ms-fontobject
        image/svg+xml;
    gzip_disable "msie6";

    # --- STATIC ASSETS CACHING ---
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(css|js)$ {
        expires 7d;
        add_header Cache-Control "public, must-revalidate";
        access_log off;
    }

    # --- UPLOADS & MEDIA ---
    location /uploads/ {
        alias $PROJECT_ROOT/server/uploads/;
        autoindex off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # --- MAIN APPLICATION ---
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # --- API PROXY ---
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINXEOF

# Enable Site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/

# Set Permissions (Critical for static file serving and uploads)
echo "Setting folder permissions..."
chown -R www-data:www-data $PROJECT_ROOT/server/uploads
chmod -R 775 $PROJECT_ROOT/server/uploads
# Ensure the root directory is searchable by Nginx
chmod o+x $PROJECT_ROOT
chmod o+x $PROJECT_ROOT/client
chmod o+x $PROJECT_ROOT/client/dist

nginx -t && systemctl restart nginx

# PM2 Setup
pm2 stop all || true
pm2 delete all || true
pm2 start ecosystem.config.js --update-env
pm2 save
pm2 startup | tail -n 1 | bash

# Validation
echo -e "\n${BLUE}[VALIDATION] Checking Service Health...${NC}"
sleep 5
pm2 status

echo -e "\n${GREEN}=================================================${NC}"
echo -e "   DEPLOYMENT COMPLETE!                          "
echo -e "   Project Path: ${PROJECT_ROOT}                 "
echo -e "   Access URL  : http://$(curl -s ifconfig.me)   "
echo -e "=================================================${NC}"
echo -e "Run 'pm2 logs' to monitor all services."
echo -e "${GREEN}=================================================${NC}"
