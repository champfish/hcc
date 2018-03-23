var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.use('/',express.static(__dirname + '/public')); // serves static files in /html

app.get(/^(?!\/.+\/).*/, function(req, res){
	var url = req.originalUrl.substring(1);
	res.sendFile(__dirname + '/public/game/game.html');
});


var games = new Map();


// connection 
io.on('connection', function(socket){
	// request to join the room with the given name
	socket.on('joinRoom', function(name, callback){
		console.log('====================='+name);
		console.log('joinRoom');
		joinRoom(socket,name, function(){
			createGame("owner",socket,function(){
				var game = getGame(socket);
				// console.log(getPublicGame(game));
				callback(getPublicGame(game));
			});

		});

	});

	// request to create a game
	socket.on('createGame', function(questionerMode){
	}
	);

	function createGame(questionerMode,socket,callback){
		console.log('createGame');
		if(!games.get(getRoom(socket))){
			var game = {};
			game.room = getRoom(socket);
			game.owner = socket;
			game.questioner = socket;
			game.questioner.emit('isQuestioner',true); // notify new questioner
			game.questionerMode = questionerMode;
			game.players = []; // player has name (String), socket (socket), reacts (array)
			game.roundIndex = 0;
			game.time = Date.now();
			game.ongoing = true;
			game.answers = []; // answers have text (String) and player (Player)
			game.question = "Waiting...";
			console.log('++++'+game.room);
			games.set(game.room, game);
		}
		callback();
	}
	

	// request to join the game
	socket.on('joinGame', function(player){
		console.log('joinGame');
		var game = getGame(socket);
		if(game==null){
			console.log('NULLGAME');
		}
		player.socket = socket;
		game.players.push(player);
		roomPing(game);
	});

	// request to add a certain action (String) to a player's reacts (array)
	socket.on('react', function(player,action){
		console.log('react');
	var p = getPlayerBySocket(player.socket);
	p.push(action);
	//	var game = getGame(socket);
	//	var players = game.players;
	//	for(i = 0; i<players.length; i++ ){
	//		if(auth(player.socket,players[i].socket)){
	//			players[i].reacts.push(action);
	//		}
	//	}
	});

	// request from the a user to submit an answer
	socket.on('submitAnswer', function(answer){
		console.log('=======================');
		var game = getGame(socket);
		var player = getPlayerBySocket(socket);
		var answer = {text:answer, name: player.name};
		game.answers.push(answer);
		roomPing(game);
		console.log('done');
	});

	// request from the questioner to ask a question
	socket.on('askQuestion', function(question){
		console.log('askQuestion');
		var game = getGame(socket);
		if(auth(game.questioner,socket)){
			game.question = question;
			game.answers=[];
			roomPing(game);
		}
	});

	// request to move on to the next question
	socket.on('nextQuestion', function(){
		console.log('nextQuestion');
		var game = getGame(socket);
		if(auth(game.owner,socket)){
			game.questioner.emit('isQuestioner',true); // notify new questioner
			switch(questionerMode){
				case "owner":
					game.questioner = game.owner;
				break;
				case "random":
					var players = game.players;
					game.questioner = players[Math.floor(Math.random()*players.length)].socket;
				break;
				case "sequential":
					var players = game.players;
					game.questioner = players[game.roundIndex%players.length].socket;
				break;

			}
		}
		game.questioner.emit('isQuestioner',true); // notify new questioner
		roomPing(game);
	});

	// request to end the game
	socket.on('endGame', function(){
		console.log('endGame');
		var game = getGame(socket);
		if(auth(game.owner,socket)){
			game.ongoing = false;
			roomPing(game);
		}
	});

	// request for data for download
	socket.on('getDataDownload', function(callback){
		callback(getGame(socket));
	});

	// sents updated game info to all connected clients
	function roomPing(game){
		console.log('roomPing');
		game.time = Date.now();
		var room = game.room;
		var roomSockets = io.sockets.in(room);
		var publicGame = getPublicGame(game);
		roomSockets.emit('roomPing',getPublicGame(game));
	}


});

// starts the webserver listen
http.listen(port, function(){
  console.log('listening on *:' + port);
});

// returns true if the two sockets are the same, else false
function auth(socketA, socketB){
	console.log('auth');
	return(socketA == socketB);
}

// returns the room the socket is in
function getRoom(socket){
	var roomKeys = Object.keys(socket.rooms);
	return roomKeys[1];
}

// get the game the socket is in
function getGame(socket){
	//console.log(games);
	var game =  games.get(getRoom(socket));
	return game;
}

// leaves any previous room and the room name selected
function joinRoom(socket,name,callback){
	console.log('joinRoom');
	console.log('joining '+ name);
	socket.leave(getRoom(socket));
	socket.join(name, function(){
		console.log(Object.keys(socket.rooms));
		callback();
	});
}

// returns the player object of the socket
function getPlayerBySocket(socket){
	console.log('getPlayerBySocket');
	var game = getGame(socket);
	var players = game.players;
	console.log(players[0].name);
	//return players[0];
	for(i = 0; i<players.length; i++ ){
		if(auth(socket,players[i].socket)){
			return players[i];
		}
	}
}


function getPublicGame(game){
	console.log('getPublicGame');
		var publicGame = {};
		publicGame.players = [];
		for(var i =0;i<game.players.length;i++){
			publicGame.players[i] = {};
			publicGame.players[i].name = game.players[i].name;
			publicGame.players[i].reacts = game.players[i].reacts;
		}
		publicGame.roundIndex = game.roundIndex;
		publicGame.time = game.time;
		publicGame.ongoing = game.ongoing;
		publicGame.answers = game.answers;
		publicGame.question = game.question;
		// console.log(publicGame);
		return publicGame;
}

// 	WATSON DEEP LEARNING
var ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');

var toneAnalyzer = new ToneAnalyzerV3({
  username: '2670a2f3-22cb-4e95-8fe4-b98beebb88e1',
  password: 'UXU7x4NGWMWT',
  version_date: '2017-09-21',
  url: 'https://gateway.watsonplatform.net/tone-analyzer/api/'
});


// Get Tone overview
function getTone(text, callback){
	console.log(text);
	toneAnalyzer.tone(
	  {
	    tone_input: text,
	    content_type: 'text/plain'
	  },
	  function(err, tone) {
	    if (err) {
	      console.log(err);
	      callback(null);
	    } else {
	      callback(tone);
	    }
	  }
	);
}

// gets a numerical chance the text has a "anger" sentiment from 0 to 1
function getAnger(text, callback){
	getTone(text,function(sent){
		if(sent==null){
			return 0;
		}
		var tones = sent.document_tone.tones;
		var anger = 0;
		for(var i = 0; i<tones.length; i++){
			var tone = tones[i];
			if(tone.tone_id=='anger'){
				anger = tone.score;
			}
		}
		callback(anger);
		//console.log(JSON.stringify(callback, null, 2));
	});
}
