# ---------- Build Stage ----------
FROM node:18-alpine AS build
WORKDIR /app

# copy frontend package files
COPY frontend/package*.json ./
RUN npm install

# copy frontend source
COPY frontend/ ./
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:18-alpine
WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
