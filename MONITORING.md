# AppForge Monitoring

Comprehensive monitoring dashboard with Prometheus and Grafana for AppForge.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AppForge   │────>│ Prometheus  │────>│   Grafana   │
│  (Metrics)  │     │  (Storage)  │     │ (Dashboard) │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          v
                   ┌─────────────┐
                   │Alertmanager │
                   └─────────────┘
```

## Components

### Prometheus
- **Port:** 9090
- **Role:** Metrics collection and storage
- **Scrape Interval:** 15s
- **Retention:** 15 days

### Grafana
- **Port:** 3001
- **Role:** Visualization and dashboards
- **Admin:** admin / admin

### Alertmanager
- **Port:** 9093
- **Role:** Alert routing and notifications

## Metrics Collected

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `http_active_connections` - Active connections

### System Metrics
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_eventloop_lag_seconds` - Event loop lag

### Database Metrics
- `database_query_duration_seconds` - Query duration
- `database_connections` - Active connections

### Business Metrics
- `business_events_total` - Custom business events

## Getting Started

### 1. Start Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Access Dashboards

- **Grafana:** http://localhost:3001 (admin/admin)
- **Prometheus:** http://localhost:9090
- **Alertmanager:** http://localhost:9093

### 3. Add Metrics Endpoint

```typescript
// src/server.ts
import { metricsMiddleware } from './middleware/metrics';
import healthRouter from './routes/health';

app.use(metricsMiddleware());
app.use('/health', healthRouter);
```

### 4. Track Custom Metrics

```typescript
import { trackBusinessEvent, trackError } from './middleware/metrics';

// Track business events
trackBusinessEvent('user_signup');
trackBusinessEvent('agent_created');

// Track errors
trackError('validation_error', '/api/users');
```

## Dashboards

### AppForge Overview
- Request rate and response times
- Error rates and status codes
- System resource usage
- Database performance

### Access Grafana

1. Open http://localhost:3001
2. Login with admin/admin
3. Navigate to Dashboards > AppForge Monitoring

## Alerts

### Configured Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | > 0.1 errors/sec for 5m | Critical |
| HighResponseTime | p95 > 2s for 5m | Warning |
| ServiceDown | Service unreachable for 1m | Critical |
| HighMemoryUsage | > 500MB for 5m | Warning |
| HighCPUUsage | > 80% for 5m | Warning |

### Configure Notifications

Edit `monitoring/alertmanager.yml`:

```yaml
route:
  receiver: 'slack'
  group_by: ['alertname']
  
receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#alerts'
        api_url: 'YOUR_SLACK_WEBHOOK_URL'
```

## Health Endpoints

### GET /health

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "checks": {
    "database": true,
    "cache": true,
    "memory": true,
    "disk": true
  },
  "metrics": {
    "memoryUsage": 256.5,
    "cpuUsage": 12.3,
    "uptime": 3600,
    "activeConnections": 42
  }
}
```

### GET /health/metrics

Prometheus format metrics for scraping.

### GET /health/ready

Readiness check for Kubernetes/load balancers.

### GET /health/live

Liveness check for Kubernetes.

## PromQL Queries

### Request Rate
```promql
rate(http_requests_total[5m])
```

### Error Rate
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

### Response Time (p95)
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Memory Usage (MB)
```promql
process_resident_memory_bytes / 1024 / 1024
```

## Best Practices

1. **Monitor what matters** - Focus on user-impacting metrics
2. **Set meaningful alerts** - Alert on symptoms, not causes
3. **Use dashboards** - Visualize trends and patterns
4. **Review regularly** - Update metrics as the app evolves
5. **Test alerts** - Verify alerts fire correctly

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## Troubleshooting

### Prometheus not scraping

Check Prometheus targets: http://localhost:9090/targets

### Grafana showing no data

1. Verify Prometheus datasource is configured
2. Check Prometheus is scraping correctly
3. Verify metric names in queries

### Alerts not firing

1. Check alert rules in Prometheus
2. Verify Alertmanager configuration
3. Check notification channels

## Production Deployment

### Docker Compose

```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Kubernetes

Use Helm charts:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/kube-prometheus-stack
helm install monitoring prometheus-community/kube-prometheus-stack
```

## Security

1. Change default Grafana password
2. Use HTTPS for production
3. Restrict access to monitoring endpoints
4. Use authentication for Alertmanager
