FROM node:lts-alpine

# Create dir for the container
WORKDIR /usr/src/app

# Copy package.json and install all packages
COPY package.json .
RUN npm install

# Copy all source code
ADD . /usr/src/app

# Start the application
CMD [ "npm", "start" ]