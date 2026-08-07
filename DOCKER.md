# Docker Deployment Guide

This guide explains how to build and deploy AppForge using Docker.

## Quick Start

### Development

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access the app at http://localhost:5173
```

### Production

```bash
# Build and run production stack
docker-compose -f docker-compose.prod.yml up --build

# Access the app at http://localhost:80
```

## File Structure

```
AppForge/
├── Dockerfile                    # Multi-stage build definition
├── docker-compose.yml           # Local development stack
├── docker-compose.prod.yml      # Production deployment
├── .dockerignore                # Exclude files from build context
├── nginx.conf                   # Nginx production config
├── docker/
│   └── postgres/
│       └── init.sql             # Database initialization
└── DOCKER.md                    # This file
```

## Development Setup

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- `.env` file with required variables

### Start Development Stack

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f appforge-dev

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Access Services

| Service | URL | Port |
|---------|-----|------|
| AppForge (Frontend) | http://localhost:5173 | 5173 |
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |

### Hot Reload

The development setup supports hot module replacement (HMR). Changes to your source code will automatically reload in the browser.

## Production Deployment

### Build Production Image

```bash
# Build the production image
docker build -t appforge:latest --target production .

# Or use docker-compose
docker-compose -f docker-compose.prod.yml build
```

### Run Production Stack

```bash
# Start production services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f appforge

# Check health
curl http://localhost/health
```

### Environment Variables

Create a `.env.production` file:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Stripe
VITE_STRIPE_PUBLIC_KEY=pk_your-key

# Database
POSTGRES_USER=appforge
POSTGRES_PASSWORD=secure-password
POSTGRES_DB=appforge

# Redis
REDIS_PASSWORD=secure-redis-password
```

## Docker Commands

### Container Management

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# Stop a container
docker stop <container-id>

# Remove a container
docker rm <container-id>
```

### Image Management

```bash
# List images
docker images

# Remove an image
docker rmi <image-id>

# Save image to file
docker save -o appforge.tar appforge:latest

# Load image from file
docker load -i appforge.tar
```

### Logs & Debugging

```bash
# View container logs
docker logs <container-id>

# Follow logs in real-time
docker logs -f <container-id>

# Access container shell
docker exec -it <container-id> /bin/sh

# View resource usage
docker stats
```

## Deployment Platforms

### Deploy to Cloud Run (Google Cloud)

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/appforge

# Deploy to Cloud Run
gcloud run deploy appforge \
  --image gcr.io/PROJECT_ID/appforge \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Deploy to AWS ECS

```bash
# Build and push to ECR
aws ecr get-login-password --region region | docker login --username AWS --password-stdin aws_account_id.dkr.ecr.region.amazonaws.com

docker build -t appforge .
docker tag appforge:latest aws_account_id.dkr.ecr.region.amazonaws.com/appforge:latest
docker push aws_account_id.dkr.ecr.region.amazonaws.com/appforge:latest
```

### Deploy to DigitalOcean App Platform

```bash
# Push to DigitalOcean Container Registry
docker build -t appforge .
docker tag appforge:latest registry.digitalocean.com/your-registry/appforge:latest
docker push registry.digitalocean.com/your-registry/appforge:latest
```

### Deploy to VPS (Self-hosted)

```bash
# On your VPS, pull and run
docker pull your-registry/appforge:latest
docker run -d -p 80:80 --restart always appforge:latest
```

## Health Checks

The production Dockerfile includes a health check:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' <container-id>

# View health logs
docker inspect --format='{{json .State.Health}}' <container-id> | jq
```

## Security Best Practices

1. **Never commit secrets** - Use environment variables or Docker secrets
2. **Use non-root user** - Already configured in Dockerfile
3. **Scan images regularly** - Use `docker scan` or Trivy
4. **Keep images updated** - Regularly rebuild with latest base images
5. **Use .dockerignore** - Prevent sensitive files from being included
6. **Limit resource usage** - Use deploy resource limits in production

## Troubleshooting

### Build Fails

```bash
# Clear Docker cache
docker builder prune -a

# Rebuild without cache
docker build --no-cache -t appforge:latest .
```

### Container Crashes

```bash
# Check exit code
docker inspect <container-id> | grep -i exitcode

# View last logs
docker logs --tail 100 <container-id>
```

### Port Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check if postgres is running
docker-compose ps

# Test connection
docker-compose exec postgres psql -U appforge -d appforge
```

## Performance Optimization

### Build Optimization

```bash
# Use build cache efficiently
docker build --cache-from=appforge:latest -t appforge:latest .
```

### Runtime Optimization

```bash
# Limit CPU and memory
docker run --cpus="1.0" --memory="512m" appforge:latest
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)

## Support

Open an issue on GitHub for Docker-related problems or questions.
