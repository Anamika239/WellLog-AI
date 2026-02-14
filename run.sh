#!/bin/bash

# Start backend
echo "Starting backend server..."
cd backend
node server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT

# Wait for processes
wait
