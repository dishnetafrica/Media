# ---------- Build Stage ----------
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:18-alpine
WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/build ./build

EXPOSE 3000
CMD serve -s build -l 3000
