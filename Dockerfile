# 1) Сохтани frontend
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2) Backend + frontend-и тайёр дар як контейнер
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/start.sh ./start.sh
COPY --from=web /web/dist /srv/frontend/dist
RUN mkdir -p uploads && useradd -m tuyona && chown -R tuyona /srv
USER tuyona
EXPOSE 8000
CMD ["sh", "start.sh"]
