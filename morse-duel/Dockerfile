# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Call the backend through nginx's same-origin /api/ proxy (see nginx.conf.template),
# so the browser never makes a cross-origin request.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Production stage ----
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx fills ${DOMAIN} into the template at container start (see compose.yaml).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
