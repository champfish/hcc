var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;



app.use('/',express.static(__dirname + '/public')); // serves static files in /html

app.get(/^(?!\/.+\/).*/, function(req, res){
	res.sendFile(__dirname + '/public/html/chat.html');
});

io.on('connection', function(socket){
	joinRoom(socket,'default');
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

function getRoom(socket){
	var roomKeys = Object.keys(socket.rooms);
	return roomKeys[1];
}

function joinRoom(socket,name){
	socket.leave(getRoom(socket));
	socket.join(name);
}
