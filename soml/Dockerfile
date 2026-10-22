# ---------------------------------------------------------------------
# อิมเมจของอำพร OMS สำหรับ Docker                       [คอมเมนต์กรรมการ K-8]
#   target app  ระบบหลังบ้าน และบริการพิมพ์ (ใช้อิมเมจเดียวกัน ต่างกันที่คำสั่งเริ่ม)
#   target web  หน้าเว็บที่ build แล้ว เสิร์ฟด้วย nginx และส่งต่อ /api กับ /ws ไปหลังบ้าน
# ใช้ผ่าน docker-compose.yml ดูวิธีใช้ใน DOCKER.md
# ---------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY db/package.json db/
COPY backend/package.json backend/
COPY print-service/package.json print-service/
COPY frontend/package.json frontend/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace frontend && npm prune --omit=dev

FROM node:22-alpine AS app
ENV TZ=Asia/Bangkok NODE_ENV=production
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/print-service ./print-service
COPY --from=build /app/db ./db
COPY --from=build /app/docker ./docker

FROM nginx:1.27-alpine AS web
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
