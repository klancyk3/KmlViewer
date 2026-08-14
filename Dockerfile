FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=5174
ENV EXTERNAL_GPX_DIR=/maps/gpx

EXPOSE 5174

CMD ["npm", "start"]
