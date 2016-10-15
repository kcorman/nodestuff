var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs')

app.listen(8080);

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
			socket.emit('connected', username);
			socket.broadcast.emit('other_connected', username);
			//or for everybody use io.sockets.emit
			//or for just one use socket.emit
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
