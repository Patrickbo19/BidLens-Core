FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY robust-router.js ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "robust-router.js"]
