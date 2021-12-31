const config = require("./config.json");
const fs = require('fs');
const Discord = require("discord.js");
const client = new Discord.Client();
client.commands = new Discord.Collection();

const db = require('./lib/db.js');
const api = require('./lib/api.js');

// From discord.js Documentation to add commands from individual files
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	// set a new item in the Collection
	// with the key as the command name and the value as the exported module
	client.commands.set(command.name, command);
}

function checkForNewBlock() {
	api.checkForNewBlock(function(newBlock, blockDetails) {
		if (newBlock) {
			const channel = client.channels.cache.get(config.CHANNEL_ID);
			let effort = (blockDetails.shares / blockDetails.diff);
			
			/*
				green    0.5 >= effort > 0
				yellow   1   >= effort > 0.5
				red	            effort > 1
			*/

			let effortRGB = [0, 255, 0]
			if (effort > 0.5) { effortRGB[0] = 255; }
			if (effort > 1) { effortRGB[1] = 0; }
			
			embed = new Discord.MessageEmbed()
				.setTitle('New Block Found!')
				.setURL(config.BLOCK_EXPLORER+blockDetails.height)
				.setColor(effortRGB) //make it green/yellow/red based on effort
				// .setColor(0xff6600) //make it monero orange
				// .setDescription('Informative text to add at start')
				.addField('Hash', blockDetails.hash, false)
				.addField('Diff', blockDetails.diff, true)
				.addField('Height', blockDetails.height, true)
				.addField('Value', blockDetails.value, true)
				.addField('Effort', (effort * 100).toFixed(2) + '%', true);
		
			channel.send(embed);

			config.LAST_BLOCK_HASH = blockDetails.hash;
			
		}
		setTimeout(checkForNewBlock, config.CHECK_INTERVAL);	
	});
}

client.login(config.BOT_TOKEN);

client.on('ready', () => {
	//	console.log(`Logged in as ${client.user.tag}!`); // uncomment to debug
	checkForNewBlock();
});

// From discord.js Documentation to add commands from individual files
client.on('message', message => {
	if (!message.content.startsWith(config.PREFIX) || message.author.bot) return;

	const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	if (!client.commands.has(command)) return;

	try {
		client.commands.get(command).execute(message, args, db);
	} catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!');
	}
});
