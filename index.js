const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildIntegrations
  ]
});

// Target channel IDs for moderation triggers
const targetChannels = [
  '1361838672818995312',
  '1366888045164499097',
  '1362441078908784793',
  '1366886810885689456',
  '1366887040498663634',
  '1364277004198875278'
];

// Moderation alert channel
const MOD_CHANNEL_ID = '1362988156546449598';

// DISBOARD bump channel
const BUMP_CHANNEL_ID = '1361848627789828148';

// Kyber news channel
const NEWS_CHANNEL_ID = '1363367257010606231';

// File to store last posted Kyber news article
const LAST_POST_FILE = './last_post.json';

// Keywords for moderation triggers
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
  console.log('Guilds the bot is in:', client.guilds.cache.map(guild => `${guild.name} (${guild.id})`));
  const guild = client.guilds.cache.get('1361838672265089225');
  if (!guild) {
    console.error('Guild not found. Ensure the bot is in the server and the GUILD_ID is correct.');
    return;
  }
  const echoCommand = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echo a message to a specified channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the message to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to echo')
        .setRequired(true)
    );
  try {
    await guild.commands.set([]);
    console.log(`Cleared existing guild commands in guild ${guild.id}`);
    await client.application.commands.set([]);
    console.log('Cleared existing global commands');
    await guild.commands.create(echoCommand);
    console.log(`Registered /echo slash command in guild ${guild.id}`);

    // Start DISBOARD bump reminder
    setInterval(async () => {
      try {
        const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          await channel.send('Please run /bump to promote the server!');
          console.log(`Sent DISBOARD bump reminder to channel ${BUMP_CHANNEL_ID} at ${new Date().toLocaleString()}`);
        } else {
          console.error(`Channel ${BUMP_CHANNEL_ID} not found or not text-based`);
        }
      } catch (err) {
        console.error('Failed to send DISBOARD bump reminder:', err.message);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds (7200000 ms)

    // Test DISBOARD bump reminder
    try {
      const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        await channel.send('Test: Please run /bump to promote the server!');
        console.log(`Test DISBOARD bump reminder sent to channel ${BUMP_CHANNEL_ID} at ${new Date().toLocaleString()}`);
      } else {
        console.error(`Test failed: Channel ${BUMP_CHANNEL_ID} not found or not text-based`);
      }
    } catch (err) {
      console.error('Test failed to send DISBOARD bump reminder:', err.message);
    }

    // Start Kyber news fetching
    const fetchKyberNews = async () => {
      try {
        const response = await axios.get('https://kyber.gg/news/');
        const $ = cheerio.load(response.data);
        const articles = [];
        $('.blog-post').each((i, element) => {
          const title = $(element).find('.blog-post-title a').text().trim();
          const link = $(element).find('.blog-post-title a').attr('href');
          const date = $(element).find('.blog-post-meta').text().trim();
          if (title && link && date) {
            articles.push({ title, link: `https://kyber.gg${link}`, date });
          }
        });
        if (articles.length === 0) {
          console.log('No Kyber news articles found');
          return;
        }
        const latestArticle = articles[0]; // Assume first article is newest
        let lastPost = {};
        try {
          lastPost = JSON.parse(await fs.readFile(LAST_POST_FILE, 'utf8'));
        } catch (err) {
          if (err.code !== 'ENOENT') console.error('Error reading last_post.json:', err.message);
        }
        if (lastPost.title !== latestArticle.title || lastPost.link !== latestArticle.link) {
          const channel = await client.channels.fetch(NEWS_CHANNEL_ID);
          if (channel && channel.isTextBased()) {
            await channel.send({
              content: `📰 **New Kyber News Update**\n**${latestArticle.title}**\n📅 ${latestArticle.date}\n🔗 ${latestArticle.link}`
            });
            console.log(`Posted Kyber news to channel ${NEWS_CHANNEL_ID}: ${latestArticle.title}`);
            await fs.writeFile(LAST_POST_FILE, JSON.stringify(latestArticle, null, 2));
          } else {
            console.error(`News channel ${NEWS_CHANNEL_ID} not found or not text-based`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch Kyber news:', err.message);
      }
    };
    setInterval(fetchKyberNews, 45 * 24 * 60 * 60 * 1000); // 45 days in milliseconds (3888000000 ms)
    await fetchKyberNews(); // Run once on startup
  } catch (error) {
    console.error('Failed to register slash commands or start services:', error.message);
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
      console.error('Failed to handle extreme content:', err.message);
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
          console.error('Failed to send mod alert:', err.message);
        }
      } else {
        console.error("Audio file missing at:", filePath);
      }
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  console.log(`Interaction received: ${interaction.type}, Command: ${interaction.commandName || 'none'}`);
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'echo') {
    console.log(`Processing /echo for user ${interaction.user.id}`);
    const targetChannel = interaction.options.getChannel('channel');
    const echoMessage = interaction.options.getString('message');
    if (!targetChannel.isTextBased()) {
      return interaction.reply('❌ The specified channel must be a text channel.');
    }
    try {
      await targetChannel.send({
        content: `📢 **Announcement from <@${interaction.user.id}>:** ${echoMessage}`
      });
      await interaction.reply(`✅ Message echoed to <#${targetChannel.id}>!`);
    } catch (err) {
      console.error('Failed to echo message:', err.message);
      await interaction.reply('❌ An error occurred while echoing the message. Check bot permissions.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
