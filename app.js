var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 80;

// returns any public file
app.use('/',express.static(__dirname + '/public')); // serves static files in /html

// returns the game file
app.get(/^(?!\/.+\/).*/, function(req, res){
	var url = req.originalUrl.substring(1);
	res.sendFile(__dirname + '/public/game/game.html');
});


var games = new Map();


// connection 
io.on('connection', function(socket){
	// removes the socket from the game, passing on roles and deleteing game as needed.
	socket.on('disconnecting', function(){
		var g = getGame(socket);
		removePlayerBySocket(socket);
		if(g.players.length==0){
			deleteGame(socket);
			return;
		}
		else if(auth(socket,g.owner)){
			g.owner = g.players[0];
		}
		else if(auth(socket,g.questioner)){
			g.questioner=g.players[0];
		}
		roomPing(g);
	});

	// return true if game exists, false otherwise
	socket.on('gameExists', function(name,callback){
		console.log('GAMEEXISTS');
		callback(gameExists(name));
	});

	// returns true if game with given name exists, false otherwise
	function gameExists(name){
		for(var [k,v] of games){
			if(k==name){
				return true;
			}
		}
		return false;
	}


	// request to join the room with the given name
	socket.on('joinRoom', function(name, callback){
		console.log('Joining Room: '+name);		
		joinRoom(socket,name, function(){
			var game = getGame(socket);
			callback(getPublicGame(game));
		});

	});

	// request to create a game
	socket.on('createGame', function(name, questionerMode, aiEnabled, callback){
			createGame(name, questionerMode, aiEnabled, socket, function(){
				callback();
			});
		}); 


	// creates room if not already created
	function createGame(name, questionerMode, aiEnabled, socket, callback){
		console.log('createGame');
		if(!games.get(getRoom(socket))){
			console.log("ACTUALLYCREATINGGAMEHERE");
			var game = {};
			//game.room = getRoom(socket);
			game.room = name;
			game.aiEnabled = aiEnabled;
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
	});

	var angerThreshold = 0.6;
	// request from the a user to submit an answer
	socket.on('submitAnswer', function(answer){
		console.log('ANSWER GOT');
		var game = getGame(socket);
		var player = getPlayerBySocket(socket);
		var answer = {text:answer, name: player.name};
		if(game.aiEnabled){
			getAnger(answer.text,function(anger){
				console.log(anger);
				if(anger<angerThreshold){
					game.answers.push(answer);
					roomPing(game);					
				}
			});
		}else{
			game.answers.push(answer);
			roomPing(game);
		}
		console.log('ANSWER SENT');
	});

	// request from the questioner to ask a question
	socket.on('askQuestion', function(question){
		console.log('askQuestion');
		var game = getGame(socket);
		if(auth(game.questioner,socket)){
			game.question = question;
			game.answers=[];
			changeQuestioner(socket);
			roomPing(game);
		}
	});

	// request to move on to the next question
	socket.on('nextQuestion', function(){
		console.log('nextQuestion');
		var game = getGame(socket);
		if(auth(game.owner,socket)){
			changeQuestioner(socket);
		}
		roomPing(game);
	});
	
	// changes the questioner based on the mode
	function changeQuestioner(socket){
		var game = getGame(socket);
		game.roundIndex++;
		game.questioner.emit('isQuestioner',false); // notify old questioner
			switch(game.questionerMode){
				default:
				case "owner":
				console.log('owner');
					game.questioner = game.owner;
				break;
				case "random":
					console.log('random');
					var players = game.players;
					game.questioner = players[Math.floor(Math.random()*players.length)].socket;
				break;
				case "sequential":
					var players = game.players;
						console.log('sequential');
					game.questioner = players[game.roundIndex%players.length].socket;
				break;
		}
		game.questioner.emit('isQuestioner',true); // notify new questioner
		roomPing(game);
	}

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
	var game =  games.get(getRoom(socket));
	return game;
}

// deltes the game the socket is in
function deleteGame(socket){
	games.delete(getRoom(socket));
}

// leaves any previous room and the room name selected
function joinRoom(socket,name,callback){
	console.log('joining room: '+ name);
	socket.leave(getRoom(socket));
	socket.join(name, function(){
		console.log(Object.keys(socket.rooms));
		callback();
	});
}

// returns the player object of the socket
function getPlayerBySocket(socket){
	var game = getGame(socket);
	if(game==null){
		console.log('Error in getting player');
	}else{
	var players = game.players;
		for(i = 0; i<players.length; i++ ){
			if(auth(socket,players[i].socket)){
				return players[i];
			}
		}
	}
}

// removes the player object of the socket from the list
function removePlayerBySocket(socket){
	var game = getGame(socket);
	var players = game.players;
	for(i = 0; i<players.length; i++ ){
		if(auth(socket,players[i].socket)){
			players.splice(i,1);
			return;
		}
	}
}

function getPublicGame(game){
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
