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
		joinRoom(socket,name);
		var game = getGame(socket);
		callback(game);
	});

	// request to create a game
	socket.on('createGame', function(questionerMode){
		if(!games.get(getRoom(socket))){
			var game;
			game.room = getRoom(socket);
			game.owner = socket;
			game.questioner = socket;
			game.questionerMode = questionerMode;
			game.players = []; // player has name (String), socket (socket), reacts (array)
			game.roundIndex = 0;
			game.time = Date.now();
			game.ongoing = true;
			game.answers = []; // answers have text (String) and player (Player)
			game.question = "Waiting...";
			games.set(game.room, game);
			roomPing(game);
		}
	});

	// request to join the game
	socket.on('joinGame', function(player){
		var game = getGame(socket);
		player.socket = socket;
		game.players.push(player);
		roomPing(game);
	});

	// request to add a certain action (String) to a player's reacts (array)
	socket.on('react', function(player,action){
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

	// request from the questioner to ask a question
	socket.on('submitAnswer', function(answer){
		var game = getGame(socket);
		var player = getPlayerBySocket(socket);
		var answer = {text:answer, player: player};
		game.answers.push(answer);
		roomPing(game);
	});

	// request from the questioner to ask a question
	socket.on('askQuestion', function(question){
		var game = getGame(socket);
		if(auth(game.questioner,socket)){
			game.question = question;
		}
		roomPing(game);
	});

	// request to move on to the next question
	socket.on('nextQuestion', function(){
		var game = getGame(socket);
		if(auth(game.owner,socket)){
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
		roomPing(game);
	});

	// request to end the game
	socket.on('endGame', function(){
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
		game.time = Date.now();
		io.sockets.in(game.room).emit('roomPing',game);
	}


});

// starts the webserver listen
http.listen(port, function(){
  console.log('listening on *:' + port);
});

// returns true if the two sockets are the same, else false
function auth(socketA, socketB){
	return(socketA == socketB);
}

// returns the room the socket is in
function getRoom(socket){
	var roomKeys = Object.keys(socket.rooms);
	return roomKeys[1];
}

// get the game the socket is in
function getGame(socket){
	return games.get(getRoom(socket));
}

// leaves any previous room and the room name selected
function joinRoom(socket,name){
	socket.leave(getRoom(socket));
	socket.join(name);
}

// returns the player object of the socket
function getPlayerBySocket(socket){
	var game = getGame(socket);
	var players = game.players;
	for(i = 0; i<players.length; i++ ){
		if(auth(socket,players[i].socket)){
			return players[i];
		}
	}
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
