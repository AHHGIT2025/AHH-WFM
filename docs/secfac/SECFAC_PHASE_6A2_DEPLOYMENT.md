# SECFAC Phase 6A.2 — Deployment Guide & Verification Sequence

## SERVER Deployment Sequence (To be executed on SERVER only after verification and push)

**SERVER Path:** `D:\Apps\AHH-WFM\dev`

```powershell
# RUN ON SERVER
cd "D:\Apps\AHH-WFM\dev"
git status
git fetch origin manpower-operations-scope
git reset --hard origin/manpower-operations-scope
git rev-parse HEAD

npm install
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npx prisma generate --schema packages/database/prisma/schema.prisma

npm run build:web
npm run build:mobile

pm2 restart ahh-wfm-web ahh-wfm-mobile
pm2 status
```

## Post-Deployment Verification
1. Verify web app accessibility: `http://10.10.50.24:3200`
2. Verify mobile app accessibility: `http://10.10.50.24:3201`
3. Verify worker health: `POST /api/v1/secfac/workers/run-phase6a2`
