# 1. Base image
FROM node:18-alpine

# 2. Set working directory
WORKDIR /app

# 3. Copy package files and install deps
COPY package*.json ./
RUN npm ci

# 4. Copy source & build
COPY . .
RUN npm run build

# 5. Expose the port your service listens on
EXPOSE 4500

# 6. Start the app
CMD ["node", "dist/main.js"]
