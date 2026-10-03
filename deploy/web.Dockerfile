# Site: Next.js. API'ye iç ağdan bağlanır (API_URL); medya /media yolu API'ye aktarılır.
# Derleme bağlamı depo kökü: docker build -f deploy/web.Dockerfile .
FROM node:22-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY mobile/package.json mobile/
COPY web/package.json web/
RUN npm ci --workspace web --workspace @tms/shared --include-workspace-root --no-audit --no-fund
COPY shared shared
COPY tsconfig.json ./
COPY web web
# Sitenin genel adresi (kanonik bağlantılar, site haritası); derlemede sayfalara gömülür.
ARG NEXT_PUBLIC_SITE_URL=https://teknemisatiyorum.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# API'nin iç ağ adresi. /media yönlendirmesi derlemede sabitlenir, bu yüzden gerçek adres verilir;
# derlemede API'ye ulaşılamaz, sayfalar istek anında (ve önbellek süresiyle) API'den okunur.
ARG API_URL=http://api:3000
ENV API_URL=$API_URL
RUN npm run build -w @tms/shared && npm run build -w web
WORKDIR /app/web
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001", "-H", "0.0.0.0"]
