FROM node:20-slim

WORKDIR /app

# Install build deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --production

COPY src ./src

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "src/index.js"]
