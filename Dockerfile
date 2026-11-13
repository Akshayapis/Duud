# U APP — static site + isolated Android build engine
# Node 24.12+ is required by the Firebase 13 packages (and satisfies Vite 7).
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Optional build-time overrides. Firebase falls back to the project config in
# src/data/catalog.ts, so the build never fails when these are absent.
ARG VITE_UAPP_UPI_ID=""
ARG VITE_UAPP_UPI_NAME=""
ENV VITE_UAPP_UPI_ID=$VITE_UAPP_UPI_ID \
    VITE_UAPP_UPI_NAME=$VITE_UAPP_UPI_NAME
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/var/uapp-data

# ca-certificates is required for the build-engine HTTPS API and Firebase token checks.
RUN apk add --no-cache ca-certificates wget \
    && update-ca-certificates

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && node -e "import('busboy').then(() => import('yauzl')).then(() => console.log('runtime deps ok'))"

COPY --from=build /app/dist ./dist
COPY server ./server
COPY kaggle ./kaggle

RUN mkdir -p /var/uapp-data/sources /var/uapp-data/artifacts \
    && addgroup -S uapp \
    && adduser -S uapp -G uapp \
    && chown -R uapp:uapp /app /var/uapp-data
USER uapp

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["node", "server/index.mjs"]
