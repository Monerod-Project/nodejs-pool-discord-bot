const Discord = require("discord.js");

/*  Formatting code by Salman A
	 from: https://stackoverflow.com/a/9462382 
	License: CC BY-SA 4.0  https://creativecommons.org/licenses/by-sa/4.0/
*/
module.exports = {
	name: 'help',
	description: 'Bot Commands',
	execute(message, args) {
		embed = new Discord.MessageEmbed()
				.setTitle('Here to help!')
	//			.setURL(config.BLOCK_EXPLORER+blockDetails.height)
				.setColor(0x65a6d5) //make it monerod blue
				.setDescription('Beep Beep Boop Dumping Information...')
				.addField('!link', 'DM me this command with your mining address to connect us')
				.addField('!unlink', 'DM me this to disconnect us')
				.addField('!hashrate', 'Once linked I can announce your current hashrate')
				.addField('!hashrate average', 'Once linked I can announce your average hashrate');
		
			message.channel.send(embed);
	}
};