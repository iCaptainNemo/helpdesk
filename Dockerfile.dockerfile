# Stage 1: Build the frontend
FROM node:14 AS build-frontend

# Set the working directory
WORKDIR /app/frontend

# Copy the frontend package.json and package-lock.json
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the frontend application code
COPY frontend/ ./

# Build the frontend application
RUN npm run build

# Stage 2: Build the backend
FROM node:14 AS build-backend

# Set the working directory
WORKDIR /app/backend

# Copy the backend package.json and package-lock.json
COPY Backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy the rest of the backend application code
COPY Backend/ ./

# Copy the built frontend application from the previous stage
COPY --from=build-frontend /app/frontend/build ./public

# Copy the setup script
COPY Backend/setup.sh ./

# Make the setup script executable
RUN chmod +x ./setup.sh

# Expose the port the backend runs on
EXPOSE 3001

# Start the setup script
CMD ["./setup.sh"]