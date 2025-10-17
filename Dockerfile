# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy package files for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Change ownership of app directory to nodejs user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Create .env file for runtime environment variables
# Note: Sensitive values should be passed as environment variables at runtime
RUN touch .env

# Expose port (changed to 3001 to avoid conflict with frontend)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http=require('http');const req=http.request({hostname:'localhost',port:process.env.PORT||3001,path:'/'},res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.end();"

# Start the application
CMD ["npm", "start"]
