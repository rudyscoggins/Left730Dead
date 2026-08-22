FROM node:23-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 7300

ENV PORT=7300
CMD ["npm", "start"]
