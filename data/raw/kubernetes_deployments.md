# Kubernetes Cluster Deployment & Rollout Runbook

## 1. Zero-Downtime Deployment Configuration
All microservices deployed on the production EKS cluster must use the `RollingUpdate` deployment strategy.
- **MaxSurge:** `25%` (allows temporary over-provisioning during rollouts).
- **MaxUnavailable:** `0%` (ensures zero capacity drop during pods transition).
- **Termination Grace Period:** 45 seconds to allow in-flight HTTP requests to complete cleanly.

## 2. Pod Health Checks & Probes
Every deployment pod must define both liveness and readiness probes:
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

## 3. Deployment CLI Commands
To manually trigger a rollout restart across production workloads:
```bash
kubectl rollout restart deployment/order-service -n production
kubectl rollout status deployment/order-service -n production --timeout=180s
```
If a pod enters `CrashLoopBackOff`, inspect logs using `kubectl logs -l app=order-service -n production --tail=100`.
