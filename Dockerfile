# Use official Node.js LTS image
FROM node:18-alpine

# Set app working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
RUN npm install -g nodemon

# time zone
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && \
    echo "Asia/Kolkata" > /etc/timezone


# Copy entire app source code into container
COPY . .

# Ensure dist & src folders exist
RUN mkdir -p public/dist src
RUN npm install -g serve
RUN npm run build-css

# Set environment PORT (optional)
ENV PORT=3000

# Expose port (matches what your app listens on)
EXPOSE 3000

# Start app (adjust if using app.js or server.js)
CMD ["node", "server.js"]
