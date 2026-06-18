# Hashboard - StartOS service image
# Build: compile the Vite app to static assets in /app/dist
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime: CGMiner proxy (:8081) + static UI and /api (:80)
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
ENV PORT=80
EXPOSE 80
CMD ["sh","-c","node server/proxy.cjs & node server/serve.cjs"]
