const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const data = require('./data.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- Block Monitor ---
async function blockMonitor() {
    try {
        const blocks = await data.getPoolBlocks();
        if (!blocks || blocks.length === 0) return;

        const latestBlock = blocks[0];

        // Check if block is new
        if (latestBlock.hash !== config.LAST_BLOCK_HASH) {
            const channel = await client.channels.fetch(config.CHANNEL_ID).catch(() => null);
            if (channel) {
                // Calculate effort (Shares / Difficulty)
                const effort = (latestBlock.shares / latestBlock.diff) * 100;
                const color = effort <= 100 ? 0x00ff00 : 0xff0000;

                const embed = new EmbedBuilder()
                    .setTitle('🚀 New Block Found!')
                    .setURL(`${config.BLOCK_EXPLORER}${latestBlock.height}`)
                    .setColor(color)
                    .addFields(
                        { name: 'Height', value: latestBlock.height.toString(), inline: true },
                        { name: 'Effort', value: `${effort.toFixed(1)}%`, inline: true },
                        { name: 'Reward', value: `${(latestBlock.value / 1e12).toFixed(4)} XMR`, inline: true },
                        { name: 'Difficulty', value: latestBlock.diff.toLocaleString(), inline: true }
                    )
                    .setTimestamp(new Date(latestBlock.ts));

                await channel.send({ embeds: [embed] });

                config.LAST_BLOCK_HASH = latestBlock.hash;
                fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
            }
        }
    } catch (err) {
        console.error('Block Monitor Error:', err.message);
    }
}

// --- Event: Ready ---
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Start block monitor loop
    setInterval(blockMonitor, config.CHECK_INTERVAL || 60000);
});

// --- Event: Member Join ---
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await member.guild.channels.fetch(config.WELCOME_CHANNEL_ID).catch(() => null);
        if (channel) {
            const welcomeMsg = await channel.send(`Welcome to the pool, ${member}! Glad to have you here. 🚀`);
            await welcomeMsg.react('👋');
        }
    } catch (err) {
        console.error('Welcome Event Error:', err.message);
    }
});

// --- Event: Message/Command Handler ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(config.PREFIX)) return;

    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {

            // 1. HELP COMMAND
            case 'help': {
                const embed = new EmbedBuilder()
                    .setTitle('Mining Bot Commands')
                    .setColor(0x65a6d5)
                    .addFields(
                        { name: '!link <addr>', value: 'Connect your XMR address (DM only)' },
                        { name: '!unlink', value: 'Remove your linked address (DM only)' },
                        { name: '!hashrate', value: 'Show current vs 24h average' },
                        { name: '!workers', value: 'List your active workers' },
                        { name: '!pool', value: 'Global pool statistics' },
                        { name: '!network', value: 'Monero network statistics' }
                    );
                return message.channel.send({ embeds: [embed] });
            }

            // 2. LINK COMMAND (DM Only)
            case 'link': {
                if (message.guild) {
                    message.delete().catch(() => {});
                    return message.author.send("⚠️ Please use `!link` here in DMs to keep your address private.");
                }
                const addr = args[0];
                if (!addr || !/^[48][0-9a-zA-Z]{94,105}$/.test(addr)) {
                    return message.reply("❌ Please provide a valid Monero address.");
                }
                await data.linkAddress(message.author.id, addr);
                return message.reply("✅ Address linked successfully! You can now use `!hashrate` and `!workers`.");
            }

            // 3. UNLINK COMMAND (DM Only)
            case 'unlink': {
                await data.unlinkAddress(message.author.id);
                return message.reply("✅ Address unlinked from your Discord account.");
            }

            // 4. HASHRATE COMMAND
            case 'hashrate':
            case 'stats': {
                const addr = await data.getUserAddress(message.author.id);
                if (!addr) return message.reply("⚠️ No address found. Use `!link <address>` in DMs first.");

                const stats = await data.getMinerStats(addr);
                const chart = await data.getMinerChart(addr);

                if (!stats || !stats.global) return message.reply("⚠️ No miner data found. Check if your miner is active.");

                // Calculate 24h Average
                let avgHash = 0;
                if (chart && chart.global && chart.global.length > 0) {
                    const oneDayAgo = (Date.now() / 1000) - 86400;
                    const recentPoints = chart.global.filter(p => p.ts >= oneDayAgo);
                    if (recentPoints.length > 0) {
                        const sum = recentPoints.reduce((a, b) => a + b.hs, 0);
                        avgHash = sum / recentPoints.length;
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('Your Miner Performance')
                    .setColor(0xff6600)
                    .addFields(
                        { name: 'Current Hashrate', value: data.formatHash(stats.global.hash), inline: true },
                        { name: '24h Average', value: data.formatHash(avgHash), inline: true },
                        { name: 'Total Hashes', value: (stats.global.totalHash || 0).toLocaleString(), inline: false },
                        { name: 'Valid Shares', value: (stats.global.validShares || 0).toLocaleString(), inline: true },
                        { name: 'Invalid Shares', value: (stats.global.invalidShares || 0).toLocaleString(), inline: true }
                    );

                return message.channel.send({ embeds: [embed] });
            }

            // 5. WORKERS COMMAND
            case 'workers': {
                const addr = await data.getUserAddress(message.author.id);
                if (!addr) return message.reply("⚠️ No address found. Use `!link <address>` in DMs first.");

                const stats = await data.getMinerStats(addr);
                if (!stats) return message.reply("⚠️ No active worker data found.");

                const workers = Object.keys(stats).filter(k => k !== 'global');

                if (workers.length === 0) return message.reply("⚠️ No named workers active.");

                const embed = new EmbedBuilder()
                    .setTitle(`Active Workers (${workers.length})`)
                    .setColor(0x00ff00);

                workers.forEach(w => {
                    const wStats = stats[w];
                    embed.addFields({ name: `👷 ${w}`, value: data.formatHash(wStats.hash), inline: true });
                });

                return message.channel.send({ embeds: [embed] });
            }

            // 6. POOL COMMAND
            case 'pool': {
                const apiData = await data.getPoolStats();
                if (!apiData || !apiData.pool_statistics) return message.reply("⚠️ Unable to fetch pool statistics.");

                const stats = apiData.pool_statistics;
                // Ensure hashrate is treated as a number
                const hashrate = stats.hash ? Number(stats.hash) : 0;

                const embed = new EmbedBuilder()
                    .setTitle('Pool Statistics')
                    .setColor(0xff6600)
                    .addFields(
                        { name: 'Pool Hashrate', value: data.formatHash(hashrate), inline: true },
                        { name: 'Miners Connected', value: (stats.miners || 0).toString(), inline: true },
                        { name: 'Total Blocks Found', value: (stats.totalBlocksFound || 0).toString(), inline: true },
                        { name: 'Last Payment', value: apiData.last_payment ? new Date(apiData.last_payment * 1000).toLocaleString() : 'Never', inline: false }
                    );
                return message.channel.send({ embeds: [embed] });
            }

            // 7. NETWORK COMMAND
            case 'network': {
                const net = await data.getNetworkStats();
                if (!net) return message.reply("⚠️ Unable to fetch network statistics.");

                const netHash = net.difficulty / 120;

                const embed = new EmbedBuilder()
                    .setTitle('Monero Network Stats')
                    .setColor(0x2196F3)
                    .addFields(
                        { name: 'Difficulty', value: net.difficulty.toLocaleString(), inline: true },
                        { name: 'Net Hashrate', value: data.formatHash(netHash), inline: true },
                        { name: 'Block Height', value: net.height.toLocaleString(), inline: true },
                        { name: 'Block Reward', value: `${(net.value / 1e12).toFixed(4)} XMR`, inline: true }
                    );
                return message.channel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error(`Command Error (${command}):`, error);
        message.reply("❌ An error occurred while executing that command.");
    }
});

client.login(config.BOT_TOKEN);
