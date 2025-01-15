FROM node:20-alpine

WORKDIR /usr/src/app

# Install curl for health checks
RUN apk --no-cache add curl

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4004

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4004/api/health || exit 1

CMD ["npm", "start"]
