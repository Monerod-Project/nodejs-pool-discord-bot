const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const pool = require('./lib/pool.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers // Required for the join event
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

/**
 * Event: New Member Joins
 */
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await member.guild.channels.fetch(config.WELCOME_CHANNEL_ID);
        if (channel) {
            const welcomeMsg = await channel.send(`Welcome to the pool, ${member}! Glad to have you here. 🚀`);
            await welcomeMsg.react('👋');
        }
    } catch (err) {
        console.error('Welcome Event Error:', err.message);
    }
});

/**
 * Block Monitor (Logic from cron.js)
 */
async function blockMonitor() {
    try {
        const blocks = await pool.getPoolBlocks();
        if (!blocks || blocks.length === 0) return;

        const latestBlock = blocks[0];
        if (latestBlock.hash !== config.LAST_BLOCK_HASH) {
            const channel = await client.channels.fetch(config.CHANNEL_ID);
            if (channel) {
                const effort = (latestBlock.shares / latestBlock.diff) * 100;
                const color = effort <= 100 ? 0x00ff00 : 0xff0000;

                const embed = new EmbedBuilder()
                    .setTitle('🚀 New Block Found!')
                    .setURL(`${config.BLOCK_EXPLORER}${latestBlock.height}`)
                    .setColor(color)
                    .addFields(
                        { name: 'Height', value: latestBlock.height.toString(), inline: true },
                        { name: 'Effort', value: `${effort.toFixed(2)}%`, inline: true },
                        { name: 'Value', value: `XMR ${latestBlock.value.toFixed(4)}`, inline: true },
                        { name: 'Hash', value: `\`${latestBlock.hash}\`` }
                    )
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                config.LAST_BLOCK_HASH = latestBlock.hash;
                fs.writeFileSync('./config.json', JSON.stringify(config, null, '\t'));
            }
        }
    } catch (err) {
        console.error('Monitor Error:', err.message);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Start block monitor loop
    setInterval(blockMonitor, config.CHECK_INTERVAL);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(config.PREFIX) || message.author.bot) return;

    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        await command.execute(message, args, pool);
    } catch (error) {
        console.error(error);
        message.reply('An error occurred executing that command.');
    }
});

client.login(config.BOT_TOKEN);
