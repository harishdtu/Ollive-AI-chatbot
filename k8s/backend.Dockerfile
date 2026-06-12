FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "src/index.js"]
