# Stage 1: Build the frontend
FROM node:14 AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend
FROM node:14 AS build-backend
WORKDIR /app/backend
COPY Backend/package*.json ./
RUN npm install
COPY Backend/ ./
COPY --from=build-frontend /app/frontend/build ./public

# Stage 3: Final runtime
FROM node:14
WORKDIR /app

# Copy built applications
COPY --from=build-backend /app/backend ./backend
COPY --from=build-frontend /app/frontend/build ./frontend

# Copy config files
COPY example_setupConfig.js .
COPY setupConfig.js* ./

COPY Backend/setup.sh /app/setup.sh
RUN chmod +x /app/setup.sh

ENV DOCKER_ENV=true
EXPOSE 3000 3001
CMD ["/app/setup.sh"]