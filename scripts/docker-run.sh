#!/bin/bash
# docker-run.sh - Start VS Agent Docker container
# Usage: ./scripts/docker-run.sh <ngrok-domain>
# Example: ./scripts/docker-run.sh abc123.ngrok-free.app

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Hologram VS Agent...${NC}"

# Check if ngrok domain is provided
if [ -z "$1" ]; then
  echo -e "${YELLOW}⚠️  No public URL provided!${NC}"
  echo -e "${YELLOW}Usage: ./scripts/docker-run.sh <your-ngrok-domain>${NC}"
  echo -e "${YELLOW}Example: ./scripts/docker-run.sh abc123.ngrok-free.app${NC}"
  echo ""
  echo -e "${YELLOW}💡 Tip: Run 'ngrok http 3001' in another terminal to get a public URL${NC}"
  exit 1
fi

NGROK_DOMAIN=$1
# Remove https:// prefix if provided
NGROK_DOMAIN="${NGROK_DOMAIN#https://}"
# Remove trailing slash if present
NGROK_DOMAIN="${NGROK_DOMAIN%/}"

# Try multiple methods to get local IP on macOS
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || \
           ipconfig getifaddr en1 2>/dev/null || \
           ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1 || \
           hostname -I | awk '{print $1}' 2>/dev/null)

if [ -z "$LOCAL_IP" ]; then
  echo -e "${RED}❌ Could not detect local IP address${NC}"
  echo -e "${YELLOW}Using localhost instead${NC}"
  LOCAL_IP="host.docker.internal"
fi

echo -e "${GREEN}📋 Configuration:${NC}"
echo -e "  Public Domain: ${NGROK_DOMAIN}"
echo -e "  Local IP: ${LOCAL_IP}"
echo -e "  Events URL: http://${LOCAL_IP}:4001"
echo ""

# Stop and remove existing container if it exists
docker stop vs-agent 2>/dev/null
docker rm vs-agent 2>/dev/null

echo -e "${GREEN}📥 Pulling VS Agent image...${NC}"
docker pull io2060/vs-agent:dev

echo ""
echo -e "${GREEN}🚀 Starting container...${NC}"
docker run -d \
  -p 3001:3001 \
  -p 3000:3000 \
  -e AGENT_PUBLIC_DID=did:web:${NGROK_DOMAIN} \
  -e AGENT_LABEL="LiveAvatar Agent" \
  -e AGENT_INVITATION_IMAGE_URL="https://raw.githubusercontent.com/2060-io/vs-agent/main/assets/hologram-logo.png" \
  -e EVENTS_BASE_URL=http://${LOCAL_IP}:4001 \
  -e USE_CORS=true \
  --name vs-agent \
  io2060/vs-agent:dev

if [ $? -eq 0 ]; then
  # Wait for container to start
  echo -e "${YELLOW}⏳ Waiting for VS Agent to start...${NC}"
  sleep 5
  
  echo -e "${GREEN}✅ VS Agent started successfully!${NC}"
  echo ""
  echo -e "${GREEN}📱 Next steps:${NC}"
  echo -e "  1. Make sure your bot server is running: ${YELLOW}pnpm run dev${NC}"
  echo -e "  2. Open invitation URL: ${YELLOW}http://localhost:3001/invitation${NC}"
  echo -e "  3. Scan QR code with Hologram app on your phone"
  echo -e "  4. Send a message and test your bot!"
  echo ""
  echo -e "${GREEN}🌐 Public URL:${NC} https://${NGROK_DOMAIN}"
  echo -e "${GREEN}🔧 Admin API:${NC} http://localhost:3000"
  echo -e "${GREEN}🔍 View logs:${NC} docker logs -f vs-agent"
  echo -e "${GREEN}🛑 Stop agent:${NC} docker stop vs-agent"
  echo ""
  echo -e "${GREEN}📜 Recent logs:${NC}"
  docker logs vs-agent 2>&1 | tail -15
else
  echo -e "${RED}❌ Failed to start VS Agent${NC}"
  docker logs vs-agent 2>&1
  exit 1
fi
