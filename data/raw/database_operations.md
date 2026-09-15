# Database Infrastructure & Connection Pool Specifications

## 1. Connection Pool Sizing
The PostgreSQL database cluster uses PgBouncer in transaction pooling mode.
- **Maximum Active Connections:** 250 connections per replica node.
- **Default Pool Size Per Service:** 25 connections.
- **Connection Timeout:** 5000 milliseconds (`connect_timeout=5s`).
- **Idle Socket Timeout:** 300 seconds before reaping idle connections.

## 2. Read-Write Splitting Rules
All write transactions (`INSERT`, `UPDATE`, `DELETE`) must be routed to the primary master endpoint `db-primary.internal:5432`.
Read-only queries can be routed to the read-replica pool `db-ro-replica.internal:5432` with a maximum acceptable replication lag threshold of 250ms.

## 3. Backup and Disaster Recovery
Backups are triggered nightly at 02:00 UTC using WAL-G.
- Point-in-time recovery (PITR) is retained for 14 continuous days in S3 bucket `s3://prod-db-wal-archives/`.
- The RTO (Recovery Time Objective) target is 30 minutes, and the RPO (Recovery Point Objective) target is 1 minute.
