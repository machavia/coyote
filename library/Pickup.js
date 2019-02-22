'use strict';

var redis = require('redis');
var bluebird = require("bluebird");
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

exports.Pickup = class {

	constructor() {
		this.db = redis.createClient();
		this.id = false;
		this.status = false;
		this.game = false;
		this.time = false;
		this.players = false;
		this.owner = false;
		this.spots = false;
	}

	async init( pickupId ) {
		if( pickupId === undefined ) throw 'Missing params';

		await this.db.hgetallAsync( 'game-' + pickupId ).then(function(obj) {
			if( obj == null ) {
				console.log( "Pickup id " + pickupId + " does not exist" );
				return false;
			}

			this.id = pickupId;
			this.game = obj['game'];
			this.time = obj['time'];
			this.status = obj['status'];
			this.players = obj['players'] == '' ? [] : obj['players'].split( ',');
			this.owner = obj['owner'];
			this.spots = obj['spots'];

		}.bind( this ) );

		return this;
	}

	cancel() {
		if( this.id === false ) {
			console.log( 'Please init pickup first' );
			return false;
		}

		this.db.del( 'game-' + this.id );
		return true;
	}

	join( userId ) {
		if( this.id == false ) {
			console.error( 'Pickup ' + this.id +  ' does not exist')
			return false
		}

		let players = this.players;
		const time = Math.floor(Date.now() / 1000);

		if( players.includes(userId) ) return false;
		if( this.spots == this.players.length ) return false
		if( this.time < time ) return false

		players.push( userId );
		this.players = players;
		players = players.join( ',');
		this.db.hset('game-' + this.id, "players", players );
	}

	leave( userId ) {

		if( this.id == false ) {
			console.error( 'Pickup ' + this.id +  ' does not exist')
			return false
		}

		this.players = this.players.remove( userId );
		let players =  this.players.join( ',');
		this.db.hset('game-' + this.id, "players", players );
	}

	setAsPublished( pickupId ) {
		this.db.hset('game-' + pickupId, "status", "published" );
	}

	setAsDone( pickupId ) {
		this.db.hset('game-' + pickupId, "status", "done" );
	}

	async create() {

		let multi = this.db.multi();
		var key = 0;
		multi.incr("key" );
		multi.get( 'key');
		multi.exec(function (err, replies) {
			if( replies[0] !== undefined ) key = replies[0];

			this.db.hmset('game-' + key, {
				'status' : 'waiting',
				'game': this.game,
				'players': this.players.join(','),
				'owner': this.owner,
				'spots' : this.spots,
				'time' : this.time,
			}, function (err, res) {
				this.id = key;
				Promise.resolve( key );
			});

		}.bind( this ));

	}

	async update() {
		await this.db.hmset('game-' + this.id, {
			'game': this.game,
			'spots' : this.spots,
			'time' : this.time,
		});
	}

	async list() {
		let keys = [];
		let games = [];
		await this.db.keysAsync("game-*").then(function(res) {
			keys = res;
		});

		//for each game we get the details
		for (let gameId of keys) {
			await this.db.hgetallAsync( gameId ).then(function(obj) {
				obj['id'] = gameId.replace('game-', '');
				obj['players'] = obj.players == '' ? [] : obj.players.split( ',');
				games.push( obj );
			});
		}

		games.sortOn('time');

		return Promise.resolve( games );
	}

	async getWaiting() {

		return this.list().then( (pickups) => {
			let time = Math.floor(Date.now() / 1000);
			let res = []

			for (let obj of pickups) if (time <= obj.time ) res.push(obj);

			return Promise.resolve( res );

		});

	}
}

Array.prototype.remove = function() {
	var what, a = arguments, L = a.length, ax;
	while (L && this.length) {
		what = a[--L];
		while ((ax = this.indexOf(what)) !== -1) {
			this.splice(ax, 1);
		}
	}
	return this;
};

Array.prototype.sortOn = function(key){
	this.sort(function(a, b){
		if(a[key] < b[key]){
			return -1;
		}else if(a[key] > b[key]){
			return 1;
		}
		return 0;
	});
}