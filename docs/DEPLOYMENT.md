# Arbitrum AI Agent Platform - Deployment Guide

**Deploy the platform anywhere - from local development to enterprise-scale production.**

This guide covers all deployment options with production-ready configurations for Docker, cloud VMs, serverless functions, and Kubernetes.

---

## Deployment Options

| Method | Best For | Complexity |
|--------|----------|------------|
| **npm CLI** | Personal use, development | Simple |
| **REST API** | Web/mobile apps, microservices | Easy |
| **Docker** | Containerized environments | Medium |
| **Cloud VM** | Production servers | Medium |
| **Serverless** | AWS Lambda, Vercel | Medium |
| **Kubernetes** | Enterprise scale | Advanced |

---

## 1. npm CLI Installation

The fastest way to get started:

```bash
# Install globally
npm install -g arbitrum-ai-agent-cli

# Verify installation
arb info

# Create your first agent
arb agent create -n MyAgent -t trading

# Configure AI features (optional)
arb config set
```

Perfect for personal use, testing, and local development.

---

## 2. REST API Server

### Local Development

```bash
# Clone the repository
git clone https://github.com/Alperen915/arbitrum-ai-agent-cli.git
cd arbitrum-ai-agent-cli

# Install dependencies
npm install

# Start the API server
npm run api
# Server available at http://localhost:3000
```

### Production with PM2

For production deployments, use PM2 for process management:

```bash
# Install PM2 globally
npm install -g pm2

# Start the API with PM2
pm2 start src/api/server.js --name arbitrum-api

# Configure auto-restart on system reboot
pm2 startup
pm2 save

# Monitor your application
pm2 monit

# View logs
pm2 logs arbitrum-api
```

---

## 3. Docker Deployment

### Quick Start

```bash
# Build the image
docker build -t arbitrum-agent-api .

# Run the container
docker run -d \
  --name arbitrum-api \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your_key \
  -v agent-data:/root/.arb-agent \
  arbitrum-agent-api

# Check logs
docker logs -f arbitrum-api
```

### Docker Compose (Recommended)

Create a `.env` file:
```bash
OPENAI_API_KEY=your_openai_api_key
```

Start the service:
```bash
docker-compose up -d
```

The included `docker-compose.yml` provides:
- Automatic restarts
- Health checks
- Persistent data volumes
- Environment variable management

### Production Docker Compose with Nginx

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build: .
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - agent-data:/root/.arb-agent
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped

volumes:
  agent-data:
```

---

## 4. Cloud VM Deployment

### Ubuntu/Debian Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install
git clone https://github.com/Alperen915/arbitrum-ai-agent-cli.git
cd arbitrum-ai-agent-cli
npm install --production

# Create systemd service
sudo tee /etc/systemd/system/arbitrum-api.service << EOF
[Unit]
Description=Arbitrum AI Agent Platform API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node src/api/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=API_PORT=3000
Environment=OPENAI_API_KEY=your_key_here

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable arbitrum-api
sudo systemctl start arbitrum-api

# Check status
sudo systemctl status arbitrum-api
```

### Nginx Reverse Proxy with SSL

```nginx
# /etc/nginx/sites-available/arbitrum-api
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and secure:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/arbitrum-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Add SSL with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 5. Serverless Deployment

### Vercel

```javascript
// api/index.js
import { app } from 'arbitrum-ai-agent-cli/api';
export default app;
```

```json
// vercel.json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" }
  ],
  "env": {
    "OPENAI_API_KEY": "@openai-api-key"
  }
}
```

Deploy:
```bash
vercel deploy --prod
```

### AWS Lambda

```yaml
# serverless.yml
service: arbitrum-agent-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  environment:
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}
  memorySize: 512
  timeout: 30

functions:
  api:
    handler: handler.handler
    events:
      - http: ANY /
      - http: ANY /{proxy+}

plugins:
  - serverless-offline
```

```javascript
// handler.js
import serverless from 'serverless-http';
import { app } from 'arbitrum-ai-agent-cli/api';

export const handler = serverless(app);
```

Deploy:
```bash
serverless deploy
```

---

## 6. Kubernetes Deployment

### Deployment Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: arbitrum-agent-api
  labels:
    app: arbitrum-agent-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: arbitrum-agent-api
  template:
    metadata:
      labels:
        app: arbitrum-agent-api
    spec:
      containers:
      - name: api
        image: your-registry/arbitrum-agent-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: arbitrum-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: arbitrum-agent-api
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: arbitrum-agent-api
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: arbitrum-agent-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: arbitrum-agent-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Deploy:
```bash
kubectl apply -f k8s/
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_PORT` | No | API server port (default: 3000) |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `NODE_ENV` | No | `development` or `production` |

---

## Health Monitoring

All deployments should monitor the health endpoint:

```bash
# Health check
curl http://localhost:3000/api/health
# {"status":"ok","platform":"Arbitrum AI Agent Platform","version":"1.0.0"}
```

### Recommended Monitoring Stack

- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **AlertManager** - Alerting

---

## Security Best Practices

1. **Always use HTTPS** in production with valid SSL certificates
2. **Implement authentication** using API keys or JWT tokens
3. **Enable rate limiting** to prevent abuse
4. **Use environment variables** for all secrets
5. **Keep dependencies updated** with regular `npm audit` checks
6. **Deploy behind a reverse proxy** (Nginx, Cloudflare, AWS ALB)
7. **Enable logging** for audit trails and debugging
8. **Set up monitoring** with alerts for errors and performance

---

## Performance Optimization

- Use **Redis** for caching API responses
- Enable **gzip compression** in Nginx
- Implement **connection pooling** for high traffic
- Use **CDN** for static assets
- Configure **horizontal scaling** for peak loads

---

**Deploy with confidence - the platform is production-ready out of the box.**
