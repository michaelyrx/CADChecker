FROM node:22-bookworm-slim AS build

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci
COPY frontend frontend
COPY nx-pdf-drawing-inspection nx-pdf-drawing-inspection
RUN cd frontend && npm run build

FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv poppler-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN python3 -m venv backend/.venv \
    && backend/.venv/bin/pip install --no-cache-dir -r backend/requirements.txt
COPY --from=build /app/frontend/.next/standalone /app
COPY --from=build /app/frontend/.next/static /app/frontend/.next/static
COPY --from=build /app/nx-pdf-drawing-inspection /app/nx-pdf-drawing-inspection

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CADLINT_DATA_DIR=/data PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app/frontend
EXPOSE 3000
CMD ["node", "server.js"]
