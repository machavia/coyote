#!/usr/bin/env node

/***
 * WEB SERVER PART
 */

/**
 * Module dependencies.
 */

var app = require('../app');
var debug = require('debug')('coyote2:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
	var port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	var bind = typeof port === 'string'
		? 'Pipe ' + port
		: 'Port ' + port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
	var addr = server.address();
	var bind = typeof addr === 'string'
		? 'pipe ' + addr
		: 'port ' + addr.port;
	debug('Listening on ' + bind);
}


/**
 * DISCORD BOT PART
 */


const config = require(__dirname + '/../config.json');
const Discord = require('discord.js');
const client = new Discord.Client();
const {EventHandler} = require(__dirname + '/../library/EventHandler');
const {Watcher} = require(__dirname + '/../library/Watcher');

var eventHandlerOb = false;

client.on('ready', () => {
	eventHandlerOb = new EventHandler(client);
	new Watcher(eventHandlerOb);
	console.log(`Logged in as ${client.user.tag}!`);
	client.user.setStatus("online");
});

client.on('disconnect', () => {
	console.log(`Logged out as ${client.user.tag}!`);
	client.user.setStatus("idle");
});

process.on('exit', (code) => {
	console.log(`About to exit with code: ${code}`);
	client.user.setStatus("idle");
});


client.on('messageReactionAdd', (reaction, user) => {
	//we want to react only to reaction to the bot messages
	if (client.user.id != reaction.message.author.id || user.id == client.user.id) return

	try {
		eventHandlerOb.handleReaction(reaction, user, 'add');
	}

	catch (error) {
		console.error(error);
	}

});

client.on('messageReactionRemove', (reaction, user) => {
	if (client.user.id != reaction.message.author.id || user.id == client.user.id) return

	try {
		eventHandlerOb.handleReaction(reaction, user, 'delete');
	}

	catch (error) {
		console.error(error);
	}
});


client.on('message', msg => {


	if (msg.channel.type != 'dm') return;

	//if (msg.author.bot) return; //if it's another bot sending the message
	//if (msg.mentions.everyone === true) return; // if the message is not for the bot
	//if (msg.channel.type != 'dm' && msg.channel.guild.id != config.serverId) return; //if the bot listing to another discord server

	try {
		eventHandlerOb.handleMessage(msg);
	}

	catch (error) {
		console.error(error);
	}

});

//makes sure we get reaction add and remove even if the message are not in cache
client.on('raw', packet => {
	// We don't want this to run on unrelated packets
	if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
	// Grab the channel to check the message from
	const channel = client.channels.get(packet.d.channel_id);
	// There's no need to emit if the message is cached, because the event will fire anyway for that
	if (channel.messages.has(packet.d.message_id)) return;
	// Since we have confirmed the message is not cached, let's fetch it
	channel.fetchMessage(packet.d.message_id).then(message => {
		// Emojis can have identifiers of name:id format, so we have to account for that case as well
		const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
		// This gives us the reaction we need to emit the event properly, in top of the message object
		const reaction = message.reactions.get(emoji);
		// Adds the currently reacting user to the reaction's users collection.
		if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
		// Check which type of event it is before emitting
		if (packet.t === 'MESSAGE_REACTION_ADD') {
			client.emit('messageReactionAdd', reaction, client.users.get(packet.d.user_id));
		}
		if (packet.t === 'MESSAGE_REACTION_REMOVE') {
			client.emit('messageReactionRemove', reaction, client.users.get(packet.d.user_id));
		}
	});
});

client.login(config.token);