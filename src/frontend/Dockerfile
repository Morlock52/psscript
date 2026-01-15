FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Copy and set entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables
ENV NODE_ENV=development
ENV VITE_PORT=3000
# Set RUN_MODE to "production" or "preview" to serve built files
ENV RUN_MODE=dev

# Expose the port the app runs on
EXPOSE 3000

# Use entrypoint script for flexible dev/prod modes
ENTRYPOINT ["/entrypoint.sh"]