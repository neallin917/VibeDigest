#!/bin/bash

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env already exists. Skipping copy."
    echo "To overwrite, delete the existing .env file first."
else
    echo "🔧 Initializing .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created successfully!"
    echo "👉 Please update .env with your actual API keys."
fi
