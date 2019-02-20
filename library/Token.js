'use strict';

var redis = require('redis');
var bluebird = require("bluebird");
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

exports.Token = class {

	constructor() {
		this.db = redis.createClient();
	}

	create( userId ) {
		const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
		const a = {
			userId : userId,
			expiration : ( Math.floor(Date.now() / 1000) ) + 60 * 10
		}

		this.db.hmset('token-' + token, a); //this is async

		return token
	}

	async get( token ) {
		return this.db.hgetallAsync( 'token-' + token )
	}

	delete( token ) {
		this.db.del( 'token-' + token );
	}

	deleteExpired() {

		//current time
		let time = Math.floor(Date.now() / 1000);


		//getting all the games
		this.db.keys("token-*", function (err, replies) {

			//for each game we get the details
			replies.forEach(function(token) {

				//getting game data
				this.db.hgetall( token, function (err, obj) {

					if( time > obj.expiration ) {
						this.db.del( token );
					}
				}.bind(this) );

			}.bind(this));


		}.bind(this));
	}
}