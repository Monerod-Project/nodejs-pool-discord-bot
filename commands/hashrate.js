const { EmbedBuilder } = require('discord.js');

function formatHash(h) {
    if (!h) return "0 H/s";
    const units = ["H/s", "KH/s", "MH/s", "GH/s"];
    let i = 0;
    while (h >= 1000 && i < units.length - 1) { h /= 1000; i++; }
    return `${h.toFixed(2)} ${units[i]}`;
}

module.exports = {
    name: 'hashrate',
    async execute(message, args, pool) {
        const addr = await pool.getUserAddress(message.author.id);
        if (!addr) return message.reply("Use `!link` in DMs first.");

        const stats = await pool.getMinerStats(addr);
        const chart = await pool.getMinerChart(addr);

        // Calculate 24h average from chart
        const dayAgo = Date.now() - 86400000;
        const recentPoints = chart.global.filter(p => p.ts >= dayAgo);
        const avg = recentPoints.reduce((a, b) => a + b.hs, 0) / (recentPoints.length || 1);

        const embed = new EmbedBuilder()
            .setTitle('Your Miner Performance')
            .setColor(0xff6600)
            .addFields(
                { name: 'Current', value: formatHash(stats.global.hash), inline: true },
                { name: '24h Average', value: formatHash(avg), inline: true },
                { name: 'Total Hashes', value: stats.global.totalHash.toLocaleString(), inline: false }
            );
        message.channel.send({ embeds: [embed] });
    }
};
