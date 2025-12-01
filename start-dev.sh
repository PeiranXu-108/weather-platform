#!/bin/bash

echo "Starting Weather Dashboard..."
echo ""

# Kill any existing node processes
echo "Stopping any existing node processes..."
killall -9 node 2>/dev/null || true

# Wait a moment
sleep 2

# Clean Next.js cache
echo "Cleaning Next.js cache..."
rm -rf .next

# Start the development server
echo ""
echo "Starting development server..."
echo "Please wait for compilation to complete..."
echo ""
npm run dev

