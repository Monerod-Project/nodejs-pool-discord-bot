const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'pool',
    async execute(message, args, pool) {
        const data = await pool.getPoolStats();
        const stats = data.pool_statistics;

        const embed = new EmbedBuilder()
            .setTitle('Pool Statistics')
            .setColor(0xff6600)
            .addFields(
                { name: 'Hashrate', value: `${(stats.hash / 1e6).toFixed(2)} MH/s`, inline: true },
                { name: 'Miners', value: stats.miners.toString(), inline: true },
                { name: 'Total Blocks', value: stats.totalBlocksFound.toString(), inline: true },
                { name: 'Last Payment', value: new Date(data.last_payment).toLocaleDateString(), inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }
};
