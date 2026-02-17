#!/bin/bash


echo "Starting backend server..."
cd backend
node server.js &
BACKEND_PID=$!


sleep 2


echo "Starting frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!


trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT


wait
