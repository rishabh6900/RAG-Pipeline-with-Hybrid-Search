# Enterprise Authentication & Security Policy

## 1. Vault Secret Rotation Workflow
All production microservices must rotate database credentials using HashiCorp Vault.
To rotate the database secret, run the following CLI command:
```bash
vault kv put secret/db-prod username="app_user" password="$(openssl rand -base64 32)"
```
Once rotated, the Vault agent sends a SIGHUP signal to the connection pooling daemon. Existing connection sockets are drained with a maximum timeout grace period of 15 minutes before hard termination.

## 2. JWT Token Expiration and Refresh
Authentication tokens issued by the auth service follow strict TTL limits:
- **Access Tokens:** Expire exactly 3600 seconds (1 hour) after issuance.
- **Refresh Tokens:** Valid for 30 days and stored in Redis with TLS encryption enabled.
- In case of compromised credentials, invoke the admin endpoint `POST /api/v2/auth/revoke-all` with header `X-Security-Override: true`.

## 3. Common Security Error Codes
- `ERR_AUTH_401_EXPIRED`: The JWT signature timestamp has expired. Re-authenticate via the `/token/refresh` endpoint.
- `ERR_AUTH_403_IP_RESTRICTED`: The client IP is not included in the corporate VPN subnet `10.240.0.0/16`.
- `ERR_AUTH_502_VAULT_UNREACHABLE`: The local Vault agent failed health checks. Verify connectivity on port 8200.
