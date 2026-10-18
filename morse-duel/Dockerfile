# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
COPY /etc/letsencrypt/live/morse.clancarr.com/ /certs
# Call the backend through nginx's same-origin /api/ proxy (see nginx.conf),
# so the browser never makes a cross-origin request.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Production stage ----
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
