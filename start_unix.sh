#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null || { echo 'Please install Node.js 20+'; exit 1; }
command -v docker >/dev/null || { echo 'Please install and start Docker'; exit 1; }
[ -f server/.env ] || cp server/.env.example server/.env
docker compose up -d --wait
npm install
npm run db:generate
npm run db:push
npm run db:seed
printf '\nWeb http://localhost:5173 | API http://localhost:8000/docs\n'
npm run dev
