#!/bin/sh

# Check for setupConfig.js
if [ ! -f ../setupConfig.js ]; then
    echo "Creating setupConfig.js from example..."
    cp ../example_setupConfig.js ../setupConfig.js
    if [ $? -ne 0 ]; then
        echo "Failed to create setupConfig.js"
        exit 1
    fi
fi

# Validate config
node -e "
const config = require('../setupConfig.js');
const required = {
    'server.port': config.server?.port,
    'server.backendUrl': config.server?.backendUrl,
    'server.frontendUrl': config.server?.frontendUrl,
    'database.type': config.database?.type,
    'security.jwtSecret': config.security?.jwtSecret,
    'security.sessionSecret': config.security?.sessionSecret,
    'activeDirectory.groups': config.activeDirectory?.groups
};

const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

if (missing.length > 0) {
    console.error('Missing required fields in setupConfig.js:', missing.join(', '));
    process.exit(1);
}
"

if [ $? -ne 0 ]; then
    echo "Configuration validation failed"
    exit 1
fi

# Start services based on environment
if [ "$DOCKER_ENV" = "true" ]; then
    cd /app/backend && npm start &
    cd /app/frontend && npm start
else
    cd ../Backend && npm start &
    cd ../frontend && npm start
fi