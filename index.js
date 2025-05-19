const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const schedule = require('node-schedule');
require('dotenv').config();

// ... (other imports and code unchanged)

// --- Google Drive Setup ---
const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : undefined,
  keyFile: process.env.GOOGLE_CREDENTIALS ? undefined : './credentials.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// Function to watch a Google Drive folder
async function watchFolder(folderId) {
  try {
    const res = await drive.files.watch({
      fileId: folderId,
      requestBody: {
        kind: 'api#channel',
        id: `channel-${Date.now()}`,
        type: 'web_hook',
        address: process.env.WEBHOOK_URL,
      },
    });
    console.log('Watching folder:', res.data);
    return res.data;
  } catch (error) {
    console.error('Error setting up watch:', error);
    throw error;
  }
}

// ... (other code until client.on('ready'))

// Start watching Google Drive folder
try {
  await watchFolder(process.env.GOOGLE_DRIVE_FOLDER_ID);
  console.log(`Started watching Google Drive folder ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
} catch (error) {
  console.error('Failed to start watching Google Drive folder:', error);
}

// ... (rest of the code unchanged)
