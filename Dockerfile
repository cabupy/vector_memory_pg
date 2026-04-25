FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY sql/ ./sql/

EXPOSE 3010

CMD ["node", "src/server.js"]
