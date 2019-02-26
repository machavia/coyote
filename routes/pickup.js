var express = require('express');
var router = express.Router();
var moment = require('moment');
moment.locale('fr');

const { Game } = require( __dirname + '/../library/Game');
const { Pickup } = require( __dirname + '/../library/Pickup');
const { Token } = require( __dirname + '/../library/Token');

const gOb = new Game()
const games = gOb.list()
games.push( 'Autre' )


/* GET home page. */
router.get('/create', function(req, res, next) {
	const token = req.query.token
	if( token === undefined ) {
		res.render('invalid_token' );
		return
	}

	const tob = new Token()
	tob.get( token ).then((dbRes) => {
		if( dbRes == null ) {
			res.render('invalid_token' );
			return
		}
		res.render('index', { games: games, token : token});

	});

});

router.post('/create', function(req, res) {
	const players = req.body.players
	const date = req.body.date
	const game = req.body.game
	const token = req.body.token
	const otherGame = req.body.otherGame
	let error = "";

	let eventTime = moment(date, 'DD/MM/YYYY HH:mm', 'fr');

	if( players <2 || players > 32 ) {
		error = "Le nombre de joueurs doit se trouver entre 2 et 32"
	}
	else if( game != 'Autre' && !games.includes( game ) ) {
		error = game +  " n'est pas dans notre liste de jeux"
	}
	else if( game == 'Autre' && otherGame == '' ) {
		error = "Tu dois spécifier un jeu"
	}
	else if( eventTime.isValid() === false ) {
		error = "Format de date invalide"
	}
	else if( eventTime.format('X') < Date.now() / 1000 ) {
		error =  'Tu ne peux pas remonter le temps. Essayes une date dans le futur.'
	}
	else if( token === undefined ) {
		error = 'Tu dois demander à Coyote un lien pour créer une partie'
	}

	if( error !== "" ) {
		res.render('index', {games: games, token: token, error: error});
	}
	else {

		const tob = new Token()
		tob.get( token ).then((dbRes) => {
			if( dbRes == null ) {
				res.render('invalid_token' );
				return
			}

			const pOb = new Pickup()
			pOb.game = ( game == 'Autre' ) ? otherGame : game
			pOb.time = eventTime.format('X');
			pOb.spots = players
			pOb.owner = dbRes.userId
			pOb.players = [dbRes.userId]
			pOb.create().then(() => {
				tob.delete( token );
				res.render('pickup_created' );
			})



		});
	}
});

module.exports = router;
