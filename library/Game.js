'use strict';

exports.Game = class {

	constructor() {
		this.games = require( __dirname + '/../games.json');
	}

	list() {
		return this.games.sort()
	}


}