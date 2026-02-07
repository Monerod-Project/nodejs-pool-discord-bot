const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    async execute(message) {
        const embed = new EmbedBuilder()
            .setTitle('Mining Bot Commands')
            .setColor(0x65a6d5)
            .addFields(
                { name: '!link <addr>', value: 'Connect your XMR address (DM only)' },
                { name: '!unlink', value: 'Remove your linked address (DM only)' },
                { name: '!hashrate', value: 'Show current vs 24h average' },
                { name: '!workers', value: 'List your active workers' },
                { name: '!pool', value: 'Global pool statistics' },
                { name: '!network', value: 'Monero network statistics' },
                { name: '!ports', value: 'Connection details for miners' }
            );
        message.channel.send({ embeds: [embed] });
    }
};
