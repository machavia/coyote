'use strict';

const { Pickup } = require('./Pickup');

exports.Watcher = class {

	constructor( chatOb ) {
		this.chat = chatOb
		this.pickupOb = new Pickup()

		setInterval(this.listPickups.bind( this ), 60 * 1000);
	}

	listPickups() {
		let time = Math.floor(Date.now() / 1000);

		this.pickupOb.list().then( (pickups) => {

			for (let pickup of pickups) {
				if( pickup.status == 'waiting' ) this.publishNewPickup( pickup )
				if( time >= pickup.time && pickup.status == 'published' ) this.startPickup( pickup )
				if( time >= (pickup.time + 60*60*2 ) && pickup.status == 'done' ) this.deleteExpired( pickup )
			}
		})
	}

	startPickup( pickup ) {

		this.pickupOb.setAsDone( pickup.id )
		for( const userId of pickup.players ) {
			this.chat.dmPlayer( userId, 'Ta partie de ' + pickup.game + ' commence maintenant !' )
		}

	}

	publishNewPickup( pickup ) {
		this.chat.publishGame( pickup ).then( (message) => {
			this.chat.defaultChannel.send( message ).then(sentMessage => sentMessage.react('👍')).then( this.pickupOb.setAsPublished( pickup.id ) );
		})
	}

	deleteExpired( pickup ) {
		this.pickupOb.init( pickup.id )
		this.pickupOb.cancel()
		this.chat.deletePickup( pickup.id )
	}
}