FROM node:18
WORKDIR /app
# Copy package files and install dependencies
COPY package.json ./
RUN npm install
# Copy client files
COPY client/ ./client/
COPY shared/ ./shared/
COPY server/ ./server/
# Copy config files
COPY tsconfig.json drizzle.config.ts vite.config.ts postcss.config.js tailwind.config.ts components.json ./
# Build the application
RUN npm run build
# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
# Expose the port
EXPOSE 8080
# Start the server
CMD ["npm", "start"]
