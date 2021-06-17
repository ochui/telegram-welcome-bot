FROM node:14
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
CMD npm run start -- -p ~/bot -t 1895100391:AAG-InORV9eSwDKPvd__JXzDEMBvuAOoVEI  -u iSatoshiVerseBot
EXPOSE 8080