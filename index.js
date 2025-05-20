const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder, ApplicationCommandType, InteractionResponseFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const schedule = require('node-schedule');
const axios = require('axios');
require('dotenv').config();

// ... (previous code remains unchanged until client.on('interactionCreate'))

// Handle interactions (slash commands and context menu)
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() && !interaction.isMessageContextMenuCommand()) return;

  const { commandName, options, targetMessage } = interaction;

  if (commandName === 'echo') {
    const channel = options.getChannel('channel');
    const message = options.getString('message');
    try {
      if (channel.isTextBased()) {
        await channel.send(message);
        await interaction.reply({ content: `Message sent to ${channel}!`, flags: InteractionResponseFlags.Ephemeral });
      } else {
        await interaction.reply({ content: 'Please select a text channel.', flags: InteractionResponseFlags.Ephemeral });
      }
    } catch (error) {
      console.error('Error handling /echo:', error);
      await interaction.reply({ content: 'Failed to send message.', flags: InteractionResponseFlags.Ephemeral }).catch(console.error);
    }
  } else if (commandName === 'translate') {
    const text = options.getString('text');
    const targetLang = options.getString('language');
    try {
      const translatedText = await translateText(text, targetLang);
      await interaction.reply(`**Original:** ${text}\n**Translated (${SUPPORTED_LANGUAGES[targetLang]}):** ${translatedText}`);
    } catch (error) {
      await interaction.reply({ content: 'Failed to translate text.', flags: InteractionResponseFlags.Ephemeral }).catch(console.error);
    }
  } else if (commandName === 'setlanguage') {
    await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });
    const language = options.getString('language');
    languagePreferences[interaction.user.id] = language;
    saveLanguagePreferences();
    try {
      await interaction.editReply(`Preferred language set to ${SUPPORTED_LANGUAGES[language]}.`);
      console.log(`Set language for user ${interaction.user.id} to ${language}`);
    } catch (error) {
      console.error('Error setting language:', error);
      await interaction.editReply({ content: 'Failed to set language. Please try again.' }).catch(console.error);
    }
  } else if (commandName === 'Translate with CringeBot') {
    await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });
    const messageContent = targetMessage.content;
    const userLang = languagePreferences[interaction.user.id] || 'en';
    console.log(`Translate with CringeBot triggered by ${interaction.user.id}, userLang: ${userLang}, message: ${messageContent}`);

    if (!userLang || userLang === 'en') {
      await interaction.editReply({ content: 'Please set a preferred language with /setlanguage (e.g., /setlanguage language:es) to translate this message.' });
      return;
    }

    try {
      const translatedText = await translateText(messageContent, userLang);
      await interaction.editReply(`**Original:** ${messageContent}\n**Translated (${SUPPORTED_LANGUAGES[userLang]}):** ${translatedText}`);
    } catch (error) {
      console.error('Error in Translate with CringeBot:', error);
      await interaction.editReply({ content: 'Failed to translate the message.' }).catch(console.error);
    }
  }
});

// ... (rest of the code remains unchanged until the end)

// Auto-translate messages and handle moderation
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Moderation logic
  if (extremeTriggers.some(trigger => content.includes(trigger))) {
    try {
      const channel = message.channel;
      const gifPath = './media/ashamed.gif';

      await message.delete();

      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      if (modChannel && modChannel.isTextBased()) {
        await modChannel.send({
          content: `🚨 **EXTREME CONTENT DETECTED**\n` +
                   `**User:** <@${message.author.id}>\n` +
                   `**Message Deleted**\n` +
                   `**Channel:** <#${channel.id}>`
        });
      }

      if (fs.existsSync(gifPath)) {
        const gifFile = new AttachmentBuilder(gifPath);
        await channel.send({
          content: `⚠️ Inappropriate content detected. A moderator has been notified.`,
          files: [gifFile]
        });
      } else {
        console.error("GIF file missing at:", gifPath);
      }
    } catch (err) {
      console.error('Failed to handle extreme content:', err);
    }
    return;
  }

  if (targetChannels.includes(message.channel.id)) {
    if (triggers.some(trigger => content.includes(trigger))) {
      const filePath = './audio/cringe.mp3';
      if (fs.existsSync(filePath)) {
        const audioFile = new AttachmentBuilder(filePath);
        await message.channel.send({
          content: `🔊 Cringe detected!`,
          files: [audioFile]
        });
        try {
          const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
          if (modChannel && channel.isTextBased()) {
            await modChannel.send({
              content: `⚠️ **Trigger detected in <#${message.channel.id}>**\n` +
                       `**User:** <@${message.author.id}>\n` +
                       `**Message:** "${message.content}"`
            });
          }
        } catch (err) {
          console.error('Failed to send mod alert:', err);
        }
      } else {
        console.error("Audio file missing at:", filePath);
      }
    }
  }

  // Auto-translate for users with preferences
  const userLang = languagePreferences[message.author.id];
  if (userLang && userLang !== 'en') {
    try {
      const translatedText = await translateText(message.content, userLang);
      await message.reply(`**Translated (${SUPPORTED_LANGUAGES[userLang]}):** ${translatedText}`);
    } catch (error) {
      console.error('Auto-translation error:', error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);