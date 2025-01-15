FROM node:18-alpine

WORKDIR /app

COPY apis/leaderboard/package*.json ./
RUN npm install

COPY apis/leaderboard/ ./

EXPOSE 4003
CMD ["npm", "start"]
