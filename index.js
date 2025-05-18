const { spawn } = require('child_process');
const express = require('express');
const app = express();

// Serve a basic endpoint for uptime monitoring
app.get('/', (req, res) => {
  res.send('Bot index.js is running.');
});

// Start server on Render-required port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 index.js web server running on port ${PORT}`);
});

// Launch Python main.py (bot)
const mainBot = spawn('python3', ['main.py'], {
  stdio: 'inherit',
});

// Launch listener.py (self-bot)
const listenerBot = spawn('python3', ['listener.py'], {
  stdio: 'inherit',
});

// Handle exits
mainBot.on('exit', (code) => {
  console.log(`main.py exited with code ${code}`);
});

listenerBot.on('exit', (code) => {
  console.log(`listener.py exited with code ${code}`);
});
