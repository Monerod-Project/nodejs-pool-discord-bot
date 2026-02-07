const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'network',
    async execute(message, args, pool) {
        const net = await pool.getNetworkStats();
        const embed = new EmbedBuilder()
            .setTitle('XMR Network Stats')
            .setColor(0x2196F3)
            .addFields(
                { name: 'Difficulty', value: net.difficulty.toExponential(2), inline: true },
                { name: 'Hashrate', value: `${(net.difficulty / 120 / 1e6).toFixed(2)} MH/s`, inline: true },
                { name: 'Height', value: net.height.toLocaleString(), inline: true },
                { name: 'Reward', value: `XMR ${(net.value / 1e12).toFixed(4)}`, inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }
};
