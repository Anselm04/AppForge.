# AppForge Deployment Guide (Phase 5)

AppForge uses Vercel for frontend deployment with automated CI/CD via GitHub Actions.

## Quick Start

### First-time setup

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link --name appforge --scope anselm04s-projects
```

### Deploy preview

```bash
# Deploy to preview (for PRs)
npm run deploy:preview
```

### Deploy production

```bash
# Deploy to production (main branch)
npm run deploy:production
```

## Automated Deployment

### Preview deployments

- Triggered automatically on pull requests
- Deploys to `appforge-preview-{PR_NUMBER}.vercel.app`
- Posts preview URL as PR comment
- Runs lint, test, and build checks

### Production deployments

- Triggered on push to `main` branch
- Deploys to `appforge.vercel.app`
- Runs full CI pipeline including security scan
- Executes smoke tests post-deployment

## Manual Deployment

### Using the deployment script

```bash
# Deploy preview
./scripts/deploy.sh preview

# Deploy production
./scripts/deploy.sh production
```

### Using Vercel CLI directly

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## Health Checks

### Check deployment health

```bash
curl https://appforge.vercel.app/health
```

### Expected response

```json
{
  "status": "ok",
  "timestamp": "2026-08-07T20:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "version": "1.0.0"
}
```

## Smoke Tests

### Run smoke tests

```bash
# Test local deployment
npx tsx src/utils/smoke-test.ts http://localhost:3000

# Test preview deployment
npx tsx src/utils/smoke-test.ts https://appforge-preview-123.vercel.app

# Test production deployment
npx tsx src/utils/smoke-test.ts https://appforge.vercel.app
```

### Smoke test checks

- ✓ Health endpoint responds
- ✓ API readiness
- ✓ Static assets load
- ✓ Root page returns HTML

## Environment Variables

### Required variables

Copy `.env.example` to `.env` and fill in:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-secret-key

# Vercel
VERCEL_TOKEN=your-vercel-token
```

### See ENVIRONMENT.md for complete list

## Rollback

### Rollback to previous deployment

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

### Emergency rollback

1. Identify last known good deployment
2. Run `vercel rollback <url> --prod`
3. Verify health endpoint
4. Run smoke tests

## Monitoring

### View deployment logs

```bash
# Recent logs
vercel logs

# Production logs
vercel logs --prod

# Follow logs
vercel logs --follow
```

### Check deployment status

```bash
# List deployments
vercel ls

# Get specific deployment
vercel inspect <deployment-url>
```

## Troubleshooting

### Build fails

```bash
# Check build locally
npm run build

# Check Vercel build logs
vercel logs --build
```

### Deployment fails

```bash
# Check Vercel project settings
vercel inspect

# Verify environment variables
vercel env ls
```

### Health check fails

```bash
# Check database connection
curl https://appforge.vercel.app/health

# Check logs for errors
vercel logs --prod --since=1h
```

## Best Practices

1. **Always test locally first**: `npm run build` before deploying
2. **Use preview deployments**: Test PRs before merging to main
3. **Monitor health**: Check `/health` after every deployment
4. **Run smoke tests**: Automated in CI, but verify manually for production
5. **Keep secrets secure**: Use Vercel environment variables, never commit `.env`
6. **Review logs**: Check deployment logs for warnings and errors

## Security

- All deployments use HTTPS
- Environment variables encrypted at rest
- Preview deployments isolated per PR
- Production requires passing CI checks
- Secret scanning in CI pipeline

## Next Steps

After deployment:

1. ✓ Verify health endpoint
2. ✓ Run smoke tests
3. ✓ Monitor logs for errors
4. ✓ Check application functionality
5. ✓ Update documentation if needed

## Support

For deployment issues:

- Check Vercel dashboard: https://vercel.com/dashboard
- Review deployment logs: `vercel logs`
- Inspect project: `vercel inspect`
- Contact team via Slack or GitHub Issues
