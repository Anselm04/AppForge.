# Security Headers

AppForge uses comprehensive HTTP security headers to protect against common web vulnerabilities.

## Headers Implemented

### Content Security Policy (CSP)

**Header:** `Content-Security-Policy`

**Purpose:** Prevents XSS and injection attacks by controlling which resources can be loaded.

**Configuration:**
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
```

### Strict Transport Security (HSTS)

**Header:** `Strict-Transport-Security`

**Purpose:** Enforces HTTPS connections to prevent protocol downgrade attacks.

**Configuration:**
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### X-Frame-Options

**Header:** `X-Frame-Options`

**Purpose:** Prevents clickjacking by controlling iframe embedding.

**Configuration:**
```http
X-Frame-Options: DENY
```

### X-Content-Type-Options

**Header:** `X-Content-Type-Options`

**Purpose:** Prevents MIME type sniffing attacks.

**Configuration:**
```http
X-Content-Type-Options: nosniff
```

### X-XSS-Protection

**Header:** `X-XSS-Protection`

**Purpose:** Enables browser's XSS filter (legacy, but still useful).

**Configuration:**
```http
X-XSS-Protection: 1; mode=block
```

### Referrer Policy

**Header:** `Referrer-Policy`

**Purpose:** Controls referrer information sent with requests.

**Configuration:**
```http
Referrer-Policy: strict-origin-when-cross-origin
```

### Cross-Origin Policies

**Headers:**
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Embedder-Policy`
- `Cross-Origin-Resource-Policy`

**Purpose:** Isolate browsing context and prevent cross-origin attacks.

**Configuration:**
```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-site
```

### Cache Control (API endpoints)

**Header:** `Cache-Control`

**Purpose:** Prevents caching of sensitive API responses.

**Configuration:**
```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

## Testing Your Configuration

### Online Tools

1. **Security Headers** - https://securityheaders.com/
2. **Mozilla Observatory** - https://observatory.mozilla.org/
3. **CSP Evaluator** - https://csp-evaluator.withgoogle.com/

### Manual Testing

```bash
# Check headers
curl -I https://your-app.com

# Look for:
# - Content-Security-Policy
# - Strict-Transport-Security
# - X-Frame-Options
# - X-Content-Type-Options
# - X-XSS-Protection
# - Referrer-Policy
```

## Development vs Production

### Development

- CSP is relaxed to allow inline scripts and eval
- HSTS is disabled
- WebSocket connections allowed

### Production

- Strict CSP enforced
- HSTS enabled with preload
- All security headers active

## Best Practices

1. ✅ Start with report-only CSP to test configuration
2. ✅ Use nonces for inline scripts when necessary
3. ✅ Avoid 'unsafe-inline' and 'unsafe-eval' in production
4. ✅ Set HSTS max-age to at least 1 year
5. ✅ Test headers with security scanning tools
6. ✅ Keep Helmet.js and dependencies updated
7. ✅ Review headers regularly for new best practices

## Resources

- [Helmet.js Documentation](https://helmetjs.github.io/)
- [MDN HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [Content Security Policy Guide](https://content-security-policy.com/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
