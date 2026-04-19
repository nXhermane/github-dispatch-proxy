#!/bin/bash

set -e

echo "Starting deployment of GitHub Dispatch Proxy..."

if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

echo "Uploading secrets to Cloudflare..."

while IFS='=' read -r key value || [ -n "$key" ]; do
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)

    # Skip empty lines and comments
    if [[ -z "$key" || "$key" =~ ^# ]]; then
        continue
    fi

    echo "   Uploading secret: $key"
    echo "$value" | bunx wrangler secret put "$key"
    
done < .env

echo "All secrets uploaded successfully"

echo "Deploying worker to Cloudflare..."
bunx wrangler deploy

echo "Deployment completed successfully!"
