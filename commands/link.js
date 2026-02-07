module.exports = {
    name: 'link',
    async execute(message, args, pool) {
        if (message.guild) {
            message.delete().catch(() => {});
            return message.author.send("Keep your address private! Use `!link` here in DMs.");
        }
        if (!args[0] || args[0].length !== 95) return message.reply("Provide a valid 95-char XMR address.");

        await pool.linkAddress(message.author.id, args[0]);
        message.reply("✅ Address linked successfully!");
    }
};
