'use strict';

const moment = require('moment');
moment.locale('fr');

const config = require( __dirname + '/../config.json');
const { Pickup } = require('./Pickup');
const { Token } = require('./Token');

exports.EventHandler = class {

	constructor( discordClient ) {
		this.discordClient = discordClient
		let guild = discordClient.guilds.find( 'name', config.server);
		config.serverId = guild.id
		this.defaultChannel = guild.channels.find( 'name', config.publicationChannel);
		this.botUserId = discordClient.user.id
	}

	handleMessage( message ) {
		this.serverId = (message.channel.guild !== undefined) ? message.channel.guild.id : false;
		this.channelId = message.channel.id;
		this.userId = message.author.id;
		this.isDM = message.channel.type == 'dm';
		this.cleanMessage = this.messageCleaner(message.content);
		this.message = message
		this.prefix = config.prefix


		console.log('ServerId : ' + this.serverId, ' | Channel : ' + this.channelId, ' | UserId ' + this.userId, ' | Message ' + message.content);

		this.dispatch()


	}

	handleReaction( reaction, user, type ) {
		if( reaction.emoji.name != "👍" && reaction.emoji.name != "❌" ) return false;

		let pickupId = reaction.message.content.match( /^\#(\d+)\s/)
		if( pickupId == null ) {
			console.error( 'Unknown pickup id');
			return false;
		}
		pickupId = pickupId[1]

		const userId = user.id
		const pOb = new Pickup()
		pOb.init( pickupId )
		.then(() => {

			if( reaction.emoji.name == "👍" ) {
				if( type == 'add' ) {
					pOb.join( userId )
				}
				else {
					pOb.leave( userId )
				}

				this.publishGame( pOb ).then((message) => {
					//reaction.message.edit( '' )
					reaction.message.edit( message )
				})
			}

			else if (
				type == 'add'
				&& reaction.emoji.name == "❌"
				&& userId == pOb.owner
			) {
				this.cancel( pickupId)
				pOb.cancel( userId )
				reaction.message.delete()
			}

		})
	}

	messageCleaner( message, withLower = true ) {
		message = message.replace('<@' + this.botUserId + '>', '');
		message = message.trim();
		if( withLower === true ) message = message.toLowerCase()
		return message;
	}

	dispatch() {

		//!creer
		if( this.cleanMessage == this.prefix +  'créer'
			||  this.cleanMessage == this.prefix +  'creer'
			||  this.cleanMessage == 'creer'
		) {
			this.create().then( (message ) => {
				this.message.author.send( message );
			});
		}

		//!liste
		/*if( this.cleanMessage == this.prefix +  'liste' ) {
			this.listPickups().then( (message) => {
				this.message.author.send( message );

			});
		}*/
	}

	async create() {
		const ob = new Token()
		const token = ob.create( this.userId )

		const message = 'Pour créer une partie utilise le lien suivant : ' +  config.portalUrl + '/pickup/create?token=' + token

		return message
	}

	async cancel( pickupOb ) {
		if( pickupOb.id === false ) return false

		const players = pickupOb.players
		const game = pickupOb.game

		for( const userId of players ) {
			let player = this.discordClient.users.get( userId );
			if( player === undefined ) {
				console.log( 'Unknown player id ' + p );
				return false;
			}
			player.send( 'Ta partie de ' + game + ' est annulée' );
		}

	}


	/**
	 * !liste
	 * @returns {Promise<T>}
	 */
	async listPickups() {
		const discordClient = this.discordClient
		const pickupOb = new Pickup()

		return pickupOb.getWaiting().then( (pickups) => {

			if( pickups.length == 0 ) {
				return Promise.resolve( 'Aucune partie n\'est programmée pour le moment. :slight_frown:' + "\n" + 'Essayes `!creer` pour en démarrer une !');
			}

			let gamesMessage = [];
			let instaPickups = [];

			for( let pickup of pickups ) {
				let message = '';

				//nombre de places libres
				let emptySpots = (pickup.spots - pickup.players.length);
				if (emptySpots == 0) message += '**COMPLET**';
				else if (emptySpots == 1) message += '**une** Place restante (vite).';
				else message += '**' + emptySpots + '** Places restantes.';

				//joueurs inscrits
				message += "\n"
				message += 'Inscrits : '
				let players = [];
				pickup.players.forEach((player) => {
					let playerOb = discordClient.users.get(player);
					if (playerOb !== undefined) players.push('__' + playerOb.username + '__')
				});
				message += players.join(' / ') + "\n";

				//pour s'inscrire
				//message += ':arrow_right: Pour s\'inscrire `!joindre ' + pickup.id + "`\n";

				if( pickup.status == 'ready' ) {
					let header = ':small_orange_diamond: Un **' + pickup.game + '** est prêt à partir !' + "\n";
					instaPickups.push( header + message);
				}
				else {
					let header = ':small_blue_diamond: **' + pickup.game + '** le *' + moment.unix(pickup.time).format('LLLL') + '*' + "\n";
					gamesMessage.push( header + message);
				}

			}

			let message = "";
			if( instaPickups.length > 0 ) {
				message += 'Les parties suivantes sont en attentes de joueurs : ' + "\n\n";
				message += instaPickups.join( '--------------------------------------' +"\n" );
				if( gamesMessage.length > 0 ) message += "\n\n";
			}

			if( gamesMessage.length > 0 ) {
				message += 'Les parties suivantes ont été programmées : ' +  "\n\n"
				message += gamesMessage.join( '--------------------------------------' +"\n" );
			}

			return Promise.resolve( message );
		});
	}


	async publishGame( pickupOb ) {

		if( pickupOb.id === false ) {
			console.log( 'No pickup id ' + pickupId );
			return false;
		}

		let owner = this.discordClient.users.get( pickupOb.owner );

		let message = '#' + pickupOb.id + ' ';
		message += 'Une partie de **' + pickupOb.game + '** est organisée par ' + owner.toString() + ' le **' + moment.unix(pickupOb.time).format('LLLL') + "**\n";
		message += "Les participants sont : ";

		var players = [];
		pickupOb.players.forEach( (player) => {
			let playerOb = this.discordClient.users.get( player );
			if( playerOb !== undefined ) players.push( playerOb.toString() )
		});

		let playerList = players.join(' / ');

		message += playerList + "\n";

		let emptySpots = (pickupOb.spots - pickupOb.players.length);
		if( emptySpots == 0 ) message += 'Plus de places disponibles';
		else {
			message += ':arrow_right: '
			if( emptySpots == 1 ) message += 'Une Place restante (vite).';
			else message += '' + emptySpots  + ' Places restantes.';
		}

		return message;

	}

	async deletePickup( pickupId) {
		this.defaultChannel.fetchMessages({limit: 100})
			.then(messages => {
				messages = messages.filter(m => m.author.id == this.botUserId )
				messages.forEach((msg) => {
					let messagePickupId = msg.content.match( /^\#(\d+)\s/)
					if( messagePickupId != null && messagePickupId[1] == pickupId ) {
						msg.delete()
					}
				})
			});
	}

	dmPlayer( userId, message ) {
		let player = this.discordClient.users.get( userId );
		if( player === undefined ) {
			console.log( 'Unknown player id ' + p );
			return false;
		}
		player.send( message );
	}

}