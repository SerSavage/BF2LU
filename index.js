const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
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

// Bump channel ID
const BUMP_CHANNEL_ID = '1361848627789828148';

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

    // Start the DISBOARD bump automation
    setInterval(async () => {
      try {
        const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          await channel.send('/bump');
          console.log(`Sent DISBOARD /bump to channel ${BUMP_CHANNEL_ID} at ${new Date().toLocaleString()}`);
        } else {
          console.error(`Channel ${BUMP_CHANNEL_ID} not found or not text-based`);
        }
      } catch (err) {
        console.error('Failed to send DISBOARD /bump:', err);
      }
    }, 3 * 60 * 60 * 1000); // 3 hours in milliseconds (10800000 ms)

    // Manual test trigger for DISBOARD bump
    try {
      const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        await channel.send('/bump');
        console.log(`Test DISBOARD /bump sent to channel ${BUMP_CHANNEL_ID} at ${new Date().toLocaleString()}`);
      } else {
        console.error(`Test failed: Channel ${BUMP_CHANNEL_ID} not found or not text-based`);
      }
    } catch (err) {
      console.error('Test failed to send DISBOARD /bump:', err);
    }
  } catch (error) {
    console.error('Failed to register slash commands:', error);
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
      console.error('Failed to echo message:', err);
      await interaction.reply('❌ An error occurred while echoing the message. Check bot permissions.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
