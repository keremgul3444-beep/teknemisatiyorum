# API: NestJS + Prisma. Açılışta migration'lar uygulanır, başlangıç verisi (yönetici, kurlar, paketler) yüklenir.
# Derleme bağlamı depo kökü: docker build -f deploy/api.Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY mobile/package.json mobile/
COPY web/package.json web/
RUN npm ci --workspace api --workspace @tms/shared --include-workspace-root --no-audit --no-fund
COPY shared shared
COPY tsconfig.json ./
COPY api api
RUN cd api && npx prisma generate && npm run build
WORKDIR /app/api
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Migration → başlangıç verisi (boş veritabanında; tekrar çalıştırmak çoğaltmaz) → sunucu.
CMD ["sh", "-c", "npx prisma migrate deploy && node --import tsx prisma/seed.ts && node dist/src/main.js"]
