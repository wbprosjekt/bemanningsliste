# Use official Node.js runtime as base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies separately to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Expose Vite default dev port
EXPOSE 5173

# Run Vite dev server and listen on all interfaces so the host can reach it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
