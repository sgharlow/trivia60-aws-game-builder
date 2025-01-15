FROM node:18-alpine

WORKDIR /app

COPY apis/get-questions/package*.json ./
RUN npm install

COPY apis/get-questions/ ./

EXPOSE 4001
CMD ["npm", "start"]
