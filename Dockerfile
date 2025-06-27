FROM node:22

WORKDIR /app

COPY package*.json ./

COPY index.mjs ./

RUN npm ci

COPY . .

RUN chmod +x ./startup.sh

ENTRYPOINT ["./startup.sh"]
