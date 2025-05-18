FROM node:18

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package.json .
RUN npm install

# Copy requirements.txt and install Python dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy all files
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]