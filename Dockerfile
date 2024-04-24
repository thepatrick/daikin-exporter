FROM node:21.7.3-alpine

COPY package.json package-lock.json /app/

WORKDIR /app

RUN npm ci

COPY . /app/

RUN npm run build

CMD npm start
