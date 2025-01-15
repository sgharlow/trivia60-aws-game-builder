FROM node:18-alpine

WORKDIR /app

COPY apis/monitor/package*.json ./
RUN npm install

COPY apis/monitor/ ./

EXPOSE 4004
CMD ["npm", "start"]
