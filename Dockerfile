FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
ENV API_PORT=3000

EXPOSE 3000

CMD ["node", "src/api/server.js"]
