var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;



app.use('/',express.static(__dirname + '/public')); // serves static files in /html

app.get(/^(?!\/.+\/).*/, function(req, res){
	var url = req.originalUrl.substring(1);
	res.sendFile(__dirname + '/public/game/testGame.html');
});


var games = new Map();


// connection 
io.on('connection', function(socket){
	// request to join the room with the given name
	socket.on('joinRoom', function(name){
		joinRoom(socket,name);
	});

	// request to create a game
	socket.on('createGame', function(){
		if(!games.get(getRoom(socket))){
			var game;
			game.room = getRoom(socket);
			game.owner = socket;
			game.questioner = socket;
			game.players = [];
			game.question = "Waiting...";
			games.set(game.room, game);
			roomPing(game);
		}
	});

	// request to join the game
	socket.on('joinGame', function(player){
		var game = getGame(socket)
		game.players.push(player);
		roomPing(game);
	});

	// request from the questioner to ask a question
	socket.on('askQuestion', function(question){
		var game = getGame(socket);
		if(game.questioner == socket){

		}
	});

	function roomPing(game){
		game.time = Date.now();
		io.sockets.in(game.room).emit('roomPing',game);
	}





	socket.on('chat message', function(msg){
		if(msg.substring(0,5)=="/join"){
  			var name = msg.substring(6);
  			socket.emit('room',name);
  			joinRoom(socket,name);
  		}else{
			io.sockets.in(getRoom(socket)).emit('chat message', msg);
  		}
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});

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
