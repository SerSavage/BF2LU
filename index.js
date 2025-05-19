const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const users = require('./users.json');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildIntegrations
  ]
});

// Target channel IDs where the bot will watch for trigger messages
const targetChannels = [
  '1361838672818995312',
  '1366888045164499097',
  '1362441078908784793',
  '1366886810885689456',
  '1366887040498663634',
  '1364277004198875278'
];

// Channel where moderation alerts should be sent
const MOD_CHANNEL_ID = '1362988156546449598';

// Keywords to trigger the bot
const triggers = [
  'bad joke', 'cringe', 'bro why', 'this is cursed', 'forbidden word',
  'not funny', 'who asked', 'kill me now', 'this ain\'t it', 'try harder',
  'that didn\'t land', 'dark humor', 'edgy much', 'cancelled', 'too soon',
  'yeesh', 'ouch', 'bruh moment', 'your humor is broken', 'dude wtf',
  'wtf did i just read', 'how is this a joke', 'zero chill', 'this belongs in the trash',
  'yikes', 'gross', 'tone deaf', 'read the room', 'problematic',
  'racist joke', 'sexist joke', 'offensive joke', 'abusive joke', 'inappropriate joke',
  'harmful joke', 'ableist joke', 'homophobic joke', 'misogynistic joke', 'distasteful joke'
];

// Extreme content triggers
const extremeTriggers = [
  'nigger', 'chink', 'gook', 'spic', 'kike', 'sand nigger', 'porch monkey',
  'slant eye', 'wetback', 'beaner', 'camel jockey', 'raghead', 'towelhead',
  'monkey', 'jungle bunny', 'zipperhead', 'yellow peril', 'coon', 'pickaninny',
  'gas the jews', 'heil hitler', 'sieg heil', 'kike', 'zionist pig',
  'oven dodger', 'hook nose', 'dirty jew', 'ashkenazi scum',
  'faggot', 'dyke', 'tranny', 'no homo', 'fudge packer', 'shemale',
  'drag freak', 'queer in a slur context', 'you’re not a real woman', 'man in a dress',
  'retard', 'spastic', 'mongoloid', 'window licker', 'cripple', 'vegetable',
  'dumbass in a targeted way', 'deaf and dumb',
  'bitch', 'cunt', 'slut', 'whore', 'hoe', 'dumb broad', 'make me a sandwich',
  'women can’t drive', 'she asked for it', 'rape her', 'kill her',
  'rape', 'rape you', 'raping', 'kill yourself', 'kms', 'kys',
  'go hang yourself', 'slit your wrists', 'choke and die',
  'beat her', 'abuse her', 'molest', 'pedophile', 'pedo', 'groomer',
  'build the wall', 'go back to your country', 'illegal alien', 'white power',
  'white pride', 'blood and soil', 'ethnic cleansing', 'great replacement',
  'kkk', 'white lives matter', '14 words', '1488', 'six million wasn’t enough',
  'going ER', 'ellen page is a man', 'beta uprising', 'soy boy', 'femoid',
  'roastie', 'chad', 'stacy', 'rape fuel', 'gymcel', 'kill all women',
  'mass shooter vibes', 'school shooter',
  'fuck you', 'die', 'i hope you die', 'you should die', 'kill all [group]',
  'useless piece of shit', 'waste of air', 'why are you alive', 'die in a fire'
];

client.on('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  const command = new SlashCommandBuilder()
    .setName('setlang')
    .setDescription('Set your preferred language')
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Language code (e.g., en, es)')
        .setRequired(true)
    );
  try {
    await client.guilds.cache.get('1361838672265089225').commands.create(command); // Replace with your guild ID
    console.log('Registered /setlang slash command in guild YOUR_GUILD_ID');
  } catch (error) {
    console.error('Failed to register slash command:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

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
          if (modChannel && modChannel.isTextBased()) {
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

  if (message.content.startsWith('!setlang ')) {
    const parts = message.content.trim().split(' ');
    const lang = parts[1]?.toLowerCase();
    const allowedLangs = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi', 'ru', 'ja'];
    if (!allowedLangs.includes(lang)) {
      return message.reply('❗ Invalid language code. Allowed: ' + allowedLangs.join(', '));
    }
    users[message.author.id] = lang;
    fs.writeFileSync(
      path.join(__dirname, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
    return message.reply(`✅ Your preferred translation language is now set to **${lang}**.`);
  }

  // --- START: Updated echo command to accept a channel ---
  if (message.content.startsWith('!echo ')) {
    const args = message.content.slice(6).trim().split(/\s+/); // Split by whitespace
    if (args.length < 2) {
      return message.reply('⚠️ Usage: !echo #channel <message> (e.g., !echo #announcements Hello World)');
    }

    // Extract channel ID from mention (e.g., <#123456789>) or raw ID
    let targetChannelId = args[0].replace(/<#|>/g, ''); // Remove <# and > from mention
    if (!/^\d+$/.test(targetChannelId)) {
      return message.reply('⚠️ Please provide a valid channel (mention the channel or use its ID).');
    }

    // Extract the message (everything after the channel)
    const echoMessage = args.slice(1).join(' ').trim();
    if (!echoMessage) {
      return message.reply('⚠️ Please provide a message to echo.');
    }

    try {
      const targetChannel = await client.channels.fetch(targetChannelId);
      if (targetChannel && targetChannel.isTextBased()) {
        await targetChannel.send({
          content: `📢 **Announcement from <@${message.author.id}>:** ${echoMessage}`
        });
        message.reply(`✅ Message echoed to <#${targetChannelId}>!`);
      } else {
        message.reply('❌ Target channel not found or is not a text channel.');
      }
    } catch (err) {
      console.error('Failed to echo message:', err);
      message.reply('❌ An error occurred while echoing the message. Check bot permissions or channel ID.');
    }
    return;
  }
  // --- END: Updated echo command ---

  try {
    const detectRes = await axios.post('https://libretranslate.de/detect', {
      q: message.content
    });
    const detectedLang = detectRes.data?.[0]?.language || 'unknown';
    const userLang = users[message.author.id] || 'en';
    if (detectedLang === userLang) return;
    const transRes = await axios.post('https://libretranslate.de/translate', {
      q: message.content,
      source: detectedLang,
      target: userLang,
      format: 'text'
    });
    const translated = transRes.data.translatedText;
    if (
      translated &&
      translated.toLowerCase().trim() !== message.content.toLowerCase().trim()
    ) {
      await message.reply({
        content: `🌍 **Translated from \`${detectedLang}\` to \`${userLang}\`:**\n> ${translated}`
      });
    }
  } catch (err) {
    console.error('Translation error:', err.message);
  }
});

client.on('interactionCreate', async (interaction) => {
  console.log(`Interaction received: ${interaction.type}, Command: ${interaction.commandName || 'none'}`);
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'setlang') {
    console.log(`Processing /setlang for user ${interaction.user.id}`);
    const lang = interaction.options.getString('language').toLowerCase();
    const allowedLangs = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi', 'ru', 'ja'];
    if (!allowedLangs.includes(lang)) {
      return interaction.reply('❗ Invalid language code. Allowed: ' + allowedLangs.join(', '));
    }
    users[interaction.user.id] = lang;
    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
    await interaction.reply(`✅ Your preferred translation language is now set to **${lang}**.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
