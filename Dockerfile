FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate --schema server/prisma/schema.prisma && npm run build
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy --schema server/prisma/schema.prisma && npm start"]
