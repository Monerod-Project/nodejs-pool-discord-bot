const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'workers',
    async execute(message, args, pool) {
        const addr = await pool.getUserAddress(message.author.id);
        if (!addr) return message.reply("Use `!link` in DMs first.");

        const stats = await pool.getMinerStats(addr);
        const workerKeys = Object.keys(stats).filter(k => k !== 'global');

        if (workerKeys.length === 0) return message.reply("No active workers detected.");

        const embed = new EmbedBuilder().setTitle('Active Workers').setColor(0x00ff00);
        workerKeys.forEach(k => {
            embed.addFields({ name: k, value: `${(stats[k].hash || 0)} H/s`, inline: true });
        });

        message.channel.send({ embeds: [embed] });
    }
};
