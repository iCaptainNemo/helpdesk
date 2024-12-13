#!/bin/sh

# Check if backend .env file exists
if [ ! -f .env ]; then
  echo "Copying .env.example.conf to .env"
  cp .env.example.conf .env
fi

# Check if backend .env file is filled out
if grep -q 'your-' .env; then
  echo "Please fill out the backend .env file with your configuration."
  exit 1
fi

# Check if frontend .env file exists
if [ ! -f ../frontend/.env ]; then
  echo "Copying ../frontend/.env.example.conf to ../frontend/.env"
  cp ../frontend/.env.example.conf ../frontend/.env
fi

# Check if frontend .env file is filled out
if grep -q 'your-' ../frontend/.env; then
  echo "Please fill out the frontend .env file with your configuration."
  exit 1
fi

# Start the backend application
npm start