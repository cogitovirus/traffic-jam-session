FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY app.js ./

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
