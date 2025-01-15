FROM node:18-alpine

WORKDIR /usr/src/app

COPY apis/add-questions/package*.json ./
RUN npm install

COPY apis/add-questions/*.js ./
COPY apis/add-questions/*.sql ./
COPY apis/add-questions/*.json ./
COPY apis/add-questions/*.txt ./

EXPOSE 4002
CMD ["npm", "start"]
