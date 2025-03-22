FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Make CLI tools executable
RUN chmod +x bin/*.js
RUN chmod +x src/cli/*.js
RUN chmod +x src/server.js

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
