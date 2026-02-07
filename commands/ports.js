const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ports',
    async execute(message, args, pool) {
        const ports = await pool.getPoolPorts();
        const embed = new EmbedBuilder()
            .setTitle('Connection Ports')
            .setColor(0xcccccc)
            .setDescription(`**Domain:** ${require('../config.json').API_DOMAIN}`);

        ports.forEach(p => {
            embed.addFields({ name: `Port ${p.port}`, value: `${p.description} (Diff: ${p.difficulty})`, inline: true });
        });

        message.channel.send({ embeds: [embed] });
    }
};
