module.exports = {
    name: 'unlink',
    async execute(message, args, pool) {
        await pool.unlinkAddress(message.author.id);
        message.reply("Address unlinked.");
    }
};
