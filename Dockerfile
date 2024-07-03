FROM node:22.4.0-alpine

COPY package.json package-lock.json /app/

WORKDIR /app

RUN npm ci

COPY . /app/

RUN npm run build

CMD npm start
