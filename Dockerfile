FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

RUN npm install

# Copy rest of the app
COPY . .

RUN npm run build

# Install serve to serve build
RUN npm install -g serve

EXPOSE 44321

CMD ["serve", "-s", "build", "-l", "44321"]
