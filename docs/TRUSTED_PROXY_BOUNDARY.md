# Trusted reverse-proxy boundary

AppForge must not trust arbitrary `X-Forwarded-For` headers. Doing so lets clients spoof identity used for rate limiting, audit logs, and IP-based protections.

Production defaults to Express's `loopback` trust preset. For a known ingress/load-balancer outside loopback, set `APPFORGE_TRUSTED_PROXY_CIDRS` to the **actual trusted proxy IP addresses or CIDRs**, e.g. `10.0.1.10/32,10.0.1.11/32` when those exact ingress addresses are controlled by the operator. Never set blanket trust to `true` or a public internet-wide range. Ensure the ingress overwrites or sanitizes externally supplied forwarding headers. Update the value only after checking the ingress network configuration.

Before serving customers, verify that direct requests containing forged `X-Forwarded-For` headers do not alter `req.ip`; requests sent through the trusted ingress must resolve to the real source address. Test multi-hop scenarios with the actual proxy chain. No hosting or paid service is necessary to review this change.
