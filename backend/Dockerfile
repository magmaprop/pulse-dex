FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./
RUN npm install --production=false
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npx", "tsx", "src/index.ts"]
```

Key changes:
- Runs `prisma generate` during build (not runtime) since `DATABASE_URL` isn't needed for generate
- Removed `prisma db push` from CMD — we'll handle that separately
- Uses exec form `CMD ["npx", "tsx", "src/index.ts"]` which is more reliable than `sh -c`
- Single `EXPOSE 4000`

Then we need to run `prisma db push` once. After the deploy succeeds, go to Railway → backend service → click **"New"** button or find **"Run Command"** in settings and run:
```
npx prisma db push
