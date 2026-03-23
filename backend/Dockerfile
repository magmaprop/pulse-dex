FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 4000 4001
CMD sh -c "npx prisma generate && npx prisma db push && npm run dev"
