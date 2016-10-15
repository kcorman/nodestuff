var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs')

app.listen(8080);

//begin game state variables
var started = false;
var players = new Array();

//end game state variables

//main function for processing user input
function processMessage(username,message,socket){
	socket.emit('recieveMsg', "[Server]You sent a special message");
}
function handler (req, res) {
	fs.readFile(_dirname + '/index.html',
		function (err, data) {
			if (err) {
				res.writeHead(500);
				return res.end('Error loading index.html');
			}
			res.writeHead(200);
			res.end(data);
		});
	}
	io.sockets.on('connection', function (socket) {
	
		socket.on('try_connect', function (username) {
			players[players.length] = username;
			socket.emit('connected', players);
			socket.broadcast.emit('other_connected', players);
			//or for everybody use io.sockets.emit
			//or for just one use socket.emit
		})
		
		socket.on('submitmsg', function (username,msg) {
			if(msg.charAt(0) == '/'){
				//socket.emit('recieveMsg', "[Server]You sent a special message"); //debugger
				processMessage(username,msg,socket);
			}else{
				socket.emit('recieveMsg', username+": "+msg);
				socket.broadcast.emit('recieveMsg', username+": "+msg);
			}
		})
		
		socket.on('test2s', function (data) {
			socket.emit('test2c', data);
		})	
		
		//example function
		socket.on('testconnection', function (username) {
			socket.broadcast.emit('testthis', username);
			//or for everybody use io.sockets.emit
			//or for just one use socket.emit
		})
});
