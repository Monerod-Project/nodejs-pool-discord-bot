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

// Helper: Format Seconds to Hours/Minutes
function formatDuration(seconds) {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

// Helper: Parse Hashrate String (e.g. "5kh") to raw hashes
function parseHashrate(input) {
    const regex = /^(\d*\.?\d+)\s*(h|kh|mh|gh|th)?$/i;
    const match = input.match(regex);
    if (!match) return null;

    let value = parseFloat(match[1]);
    const unit = match[2] ? match[2].toLowerCase() : 'h';

    switch (unit) {
        case 'kh': value *= 1e3; break;
        case 'mh': value *= 1e6; break;
        case 'gh': value *= 1e9; break;
        case 'th': value *= 1e12; break;
    }
    return value;
}

// --- Block Monitor ---
async function blockMonitor() {
    try {
        const blocks = await data.getPoolBlocks();
        if (!blocks || blocks.length === 0) return;

        const latestBlock = blocks[0];

        if (latestBlock.hash !== config.LAST_BLOCK_HASH) {
            const channel = await client.channels.fetch(config.CHANNEL_ID).catch(() => null);
            if (channel) {
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

// --- Payment Monitor ---
async function paymentMonitor() {
    try {
        const payments = await data.getPoolPayments();
        if (!payments || payments.length === 0) return;

        const latestPayment = payments[0];

        if (latestPayment.hash !== config.LAST_PAYMENT_HASH) {
            const channel = await client.channels.fetch(config.PAYMENT_CHANNEL_ID).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('💸 New Pool Payment Sent!')
                    .setColor(0xFFA500) // Orange/Gold
                    .addFields(
                        { name: 'Payees', value: latestPayment.payees.toString(), inline: true },
                        { name: 'Total Amount', value: `${(latestPayment.value / 1e12).toFixed(4)} XMR`, inline: true },
                        { name: 'Fee', value: `${(latestPayment.fee / 1e12).toFixed(6)} XMR`, inline: true },
                        { name: 'Transaction Hash', value: `\`${latestPayment.hash.substring(0, 16)}...\``, inline: false }
                    )
                    .setTimestamp(new Date(latestPayment.ts));

                await channel.send({ embeds: [embed] });

                config.LAST_PAYMENT_HASH = latestPayment.hash;
                fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
            }
        }
    } catch (err) {
        console.error('Payment Monitor Error:', err.message);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Run monitors immediately then interval
    blockMonitor();
    paymentMonitor();

    const intervalTime = config.CHECK_INTERVAL || 60000;
    setInterval(blockMonitor, intervalTime);
    setInterval(paymentMonitor, intervalTime);
});

client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await member.guild.channels.fetch(config.WELCOME_CHANNEL_ID).catch(() => null);
        if (channel) {
            const welcomeMsg = await channel.send(`Welcome to Monerod, ${member}! Glad to have you here. 🚀 (!help if you need me.)`);
            await welcomeMsg.react('👋');
        }
    } catch (err) {
        console.error('Welcome Event Error:', err.message);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(config.PREFIX)) return;

    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            // 1. HELP
            case 'help': {
                const embed = new EmbedBuilder()
                    .setTitle('Mining Bot Commands')
                    .setColor(0x65a6d5)
                    .addFields(
                        { name: '!link <addr>', value: 'Connect your XMR address (DM only)' },
                        { name: '!unlink', value: 'Remove your linked address (DM only)' },
                        { name: '!hashrate', value: 'Show current stats vs 24h average' },
                        { name: '!balance', value: 'DM your Pending and Paid balances' },
                        { name: '!workers', value: 'List your active workers' },
                        { name: '!profit <hashrate>', value: 'Estimate earnings (e.g. !profit 5kh)' },
                        { name: '!leaderboard', value: 'Top 20 Loyal Miners' },
                        { name: '!pool', value: 'Global pool statistics' },
                        { name: '!network', value: 'Monero network statistics' }
                    )
                    .setTimestamp();
                return message.channel.send({ embeds: [embed] });
            }

            // 2. LINK
            case 'link': {
                if (message.guild) {
                    message.delete().catch(() => {});
                    return message.author.send("⚠️ Please use `!link` here in DMs to keep your address private.").catch(() => {});
                }
                const addr = args[0];
                if (!addr || !/^[48][0-9a-zA-Z]{94,105}$/.test(addr)) {
                    return message.reply("❌ Please provide a valid Monero address.");
                }
                await data.linkAddress(message.author.id, addr);
                return message.reply({
                    content: "✅ Address linked successfully! You can now use `!hashrate`, `!workers`, and `!balance`.",
                    embeds: [new EmbedBuilder().setTimestamp()]
                });
            }

            // 3. UNLINK
            case 'unlink': {
                await data.unlinkAddress(message.author.id);
                return message.reply({
                    content: "✅ Address unlinked from your Discord account.",
                    embeds: [new EmbedBuilder().setTimestamp()]
                });
            }

            // 4. HASHRATE
            case 'hashrate':
            case 'stats': {
                const addr = await data.getUserAddress(message.author.id);
                if (!addr) return message.reply("⚠️ No address found. Use `!link <address>` in DMs first.");

                const stats = await data.getMinerStats(addr);
                const chart = await data.getMinerChart(addr);

                if (!stats || !stats.global) return message.reply("⚠️ No miner data found. Check if your miner is active.");

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
                        { name: 'Total Hashes', value: (stats.global.totalHashes || 0).toLocaleString(), inline: false },
                        { name: 'Valid Shares', value: (stats.global.validShares || 0).toLocaleString(), inline: true },
                        { name: 'Invalid Shares', value: (stats.global.invalidShares || 0).toLocaleString(), inline: true }
                    )
                    .setTimestamp();

                return message.channel.send({ embeds: [embed] });
            }

            // 5. WORKERS
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

                embed.setTimestamp();

                return message.channel.send({ embeds: [embed] });
            }

            // 6. BALANCE
            case 'balance': {
                const addr = await data.getUserAddress(message.author.id);
                if (!addr) return message.reply("⚠️ No address found. Use `!link <address>` in DMs first.");

                const stats = await data.getMinerStats(addr);
                if (!stats || !stats.global) return message.reply("⚠️ No miner data found yet.");

                const paid = (stats.global.amtPaid || 0) / 1e12;
                const due = (stats.global.amtDue || 0) / 1e12;
                const txCount = stats.global.txnCount || 0;

                const embed = new EmbedBuilder()
                    .setTitle('💰 Your Wallet Balance')
                    .setColor(0xFFD700)
                    .addFields(
                        { name: 'Amount Paid', value: `${paid.toFixed(6)} XMR`, inline: true },
                        { name: 'Pending Balance', value: `${due.toFixed(6)} XMR`, inline: true },
                        { name: 'Total Payments', value: txCount.toString(), inline: true }
                    )
                    .setTimestamp();

                try {
                    await message.author.send({ embeds: [embed] });
                    if (message.guild) {
                        message.react('📩');
                    }
                } catch (e) {
                    message.reply("❌ I could not DM you. Please check your privacy settings.");
                }
                return;
            }

            // 7. PROFIT
            case 'profit': {
                const input = args[0];
                if (!input) return message.reply("Usage: `!profit <hashrate>` (e.g. `!profit 5kh` or `!profit 2mh`)");

                const userHash = parseHashrate(input);
                if (!userHash) return message.reply("❌ Invalid format. Use format like `500h`, `5kh`, `1mh`.");

                const net = await data.getNetworkStats();
                if (!net) return message.reply("⚠️ Unable to fetch network stats for calculation.");

                // Constants
                const BLOCKS_PER_DAY = 720; // ~2 min blocks
                const reward = net.value / 1e12;
                const diff = net.difficulty;

                // Formula: (UserHash / Difficulty) * BlockReward * BlocksPerDay
                const dailyXMR = (userHash / diff) * reward * BLOCKS_PER_DAY;
                const weeklyXMR = dailyXMR * 7;
                const monthlyXMR = dailyXMR * 30;

                const embed = new EmbedBuilder()
                    .setTitle(`💸 Estimated Earnings for ${input.toUpperCase()}`)
                    .setColor(0x85bb65)
                    .setDescription(`Estimates based on current Network Difficulty: **${diff.toLocaleString()}**`)
                    .addFields(
                        { name: 'Daily', value: `${dailyXMR.toFixed(5)} XMR`, inline: true },
                        { name: 'Weekly', value: `${weeklyXMR.toFixed(5)} XMR`, inline: true },
                        { name: 'Monthly', value: `${monthlyXMR.toFixed(5)} XMR`, inline: true }
                    )
                    .setFooter({ text: "Electricity costs not factored in." })
                    .setTimestamp();

                return message.channel.send({ embeds: [embed] });
            }

            // 8. LEADERBOARD
            case 'leaderboard': {
                const linkedUsers = await data.getAllLinkedUsers();
                if (linkedUsers.length === 0) return message.reply("No miners have linked their Discord accounts yet.");

                const sentMsg = await message.channel.send("🔄 calculating leaderboard...");

                const minerData = [];

                // Fetch data for all linked users
                // Note: In a massive production bot, this should be cached or batched.
                for (const user of linkedUsers) {
                    const stats = await data.getMinerStats(user.addr);
                    if (stats && stats.global) {
                        minerData.push({
                            id: user.discordId,
                            totalHashes: stats.global.totalHashes || 0,
                            currentHash: stats.global.hash || 0
                        });
                    }
                }

                // Sort by Total Hashes (Loyalty + Contribution combined)
                minerData.sort((a, b) => b.totalHashes - a.totalHashes);

                // Top 20
                const top20 = minerData.slice(0, 20);

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Top 20 Loyal Miners')
                    .setColor(0xFFD700)
                    .setDescription("Ranked by Total Hashes Submitted (Loyalty + Contribution).\n*Only includes users who have linked their account.*");

                let description = "";
                let rank = 1;

                for (const miner of top20) {
                    let memberName = "Unknown Miner";
                    try {
                        // Attempt to fetch member from guild if command run in guild
                        if (message.guild) {
                            const member = await message.guild.members.fetch(miner.id).catch(() => null);
                            if (member) memberName = member.user.username;
                        } else {
                            // If DM, try client fetch
                            const user = await client.users.fetch(miner.id).catch(() => null);
                            if (user) memberName = user.username;
                        }
                    } catch (e) { }

                    const readableTotal = (miner.totalHashes / 1e9).toFixed(2) + " G"; // Billions of hashes
                    description += `**#${rank}** ${memberName} — **${readableTotal}** hashes \n`;
                    rank++;
                }

                embed.setDescription(embed.data.description + "\n\n" + description);
                embed.setTimestamp();

                await sentMsg.delete().catch(() => {});
                return message.channel.send({ embeds: [embed] });
            }

            // 9. POOL COMMAND
            case 'pool': {
                const apiData = await data.getPoolStats();
                const netData = await data.getNetworkStats();

                if (!apiData || !apiData.pool_statistics) return message.reply("⚠️ Unable to fetch pool statistics.");

                const s = apiData.pool_statistics;
                const difficulty = netData ? netData.difficulty : 1;

                const roundHashes = s.roundHashes || 0;
                const effort = (roundHashes / difficulty) * 100;
                const embedColor = effort <= 100 ? 0x00ff00 : 0xff0000;

                const embed = new EmbedBuilder()
                    .setTitle('Global Pool Statistics')
                    .setColor(embedColor)
                    .addFields(
                        { name: 'Pool Hashrate', value: data.formatHash(s.hashRate), inline: true },
                        { name: 'Miners', value: (s.miners || 0).toString(), inline: true },
                        { name: 'XMR Price', value: s.price && s.price.usd ? `$${s.price.usd.toFixed(2)}` : 'N/A', inline: true },
                        { name: 'Current Effort', value: `${effort.toFixed(2)}%`, inline: true },
                        { name: 'PPLNS Window', value: formatDuration(s.pplnsWindowTime), inline: true },
                        { name: 'Last Block Found', value: s.lastBlockFoundTime ? `<t:${s.lastBlockFoundTime}:R>` : 'Never', inline: true },
                        { name: 'Total Blocks', value: (s.totalBlocksFound || 0).toLocaleString(), inline: true },
                        { name: 'Total Paid', value: (s.totalMinersPaid || 0).toLocaleString() + ' Miners', inline: true },
                        { name: 'Total Payments', value: (s.totalPayments || 0).toLocaleString(), inline: true },
                        { name: 'Last Payment', value: apiData.last_payment ? `<t:${apiData.last_payment}:F>` : 'Never', inline: false }
                    )
                    .setTimestamp();

                return message.channel.send({ embeds: [embed] });
            }

            // 10. NETWORK
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
                    )
                    .setTimestamp();
                return message.channel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error(`Command Error (${command}):`, error);
        message.reply("❌ An error occurred while executing that command.");
    }
});

client.login(config.BOT_TOKEN);
