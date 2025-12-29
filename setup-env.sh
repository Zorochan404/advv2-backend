#!/bin/bash

# Setup Environment Variables for Adventure Cars Backend
echo "🔧 Setting up environment variables..."

# Create .env file with JWT secrets
cat > .env << EOF
# JWT Secrets for Authentication
ACCESS_TOKEN_SECRET=adventure-cars-super-secret-access-token-key-2025-make-it-long-and-secure-for-production
REFRESH_TOKEN_SECRET=adventure-cars-super-secret-refresh-token-key-2025-make-it-long-and-secure-for-production

# Server Configuration
PORT=5500
NODE_ENV=development

# Database Configuration (if needed)
# DATABASE_URL=your-database-url-here
EOF

echo "✅ Environment variables set up successfully!"
echo "📝 Created .env file with JWT secrets"
echo ""
echo "🚀 You can now run the tests:"
echo "   pnpm exec playwright test --project=api-tests"
echo ""
echo "📊 Expected test results: 95%+ success rate"





