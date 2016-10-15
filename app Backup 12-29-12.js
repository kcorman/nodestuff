var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs')

app.listen(8080);

//begin game state variables
var started = false;
var players = new Array();
var playerObjects = {}; //hash set for player names with player objects
var start = new room("GreatHall");start.descrip = "You are inside a dusty old entrance hall.";
var rooms_in_play = [start]; //list of all the rooms currently in play


//end game state variables

//OBJECT DEFINITIONS

//player object definition
function player(name){
	this.name = name;
	this.health = 10;
	this.location = start;
	this.inventory = ["Flask of Water"];
}

//room object definition
//Keep in mind that rooms can be rotated, but the legal directions are always relative to the facing direction
function room(name){
	this.name = name;
	this.descrip = "";
	this.facing = "NORTH";
	this.legal_directions = ["EAST","WEST"];
	this.coords = [0,0,0]; //x y z
	this.players = [];
}



//specific object definitions
function sitting_room(){
	this.name = "SittingRoom"
	this.descrip = "A spooky sitting room";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
}

function hallway(){
	this.name = "SpookyHallway"
	this.descrip = "A spooky hallway room. Perhaps an old witch used to beat up kittens here.";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
}

function ConanRoom(){
	this.name = "ConanRoom"
	this.descrip = "You have entered the Conan Room. You feel a slight chill crawl up your spine as you gaze into the eyes of the portrait on the western wall.  Who could it be? It feels like it is watching you.";
	this.facing = "NORTH";
	this.legal_directions = ["EAST","SOUTH"];
}

function MovieTheatre(){
	this.name = "MovieTheatre"
	this.descrip = "You find yourself in an old private movie theatre. The rows of empty seats give you the creeps.";
	this.facing = "NORTH";
	this.legal_directions = ["SOUTH"];
}

function StudyRoom(){
	this.name = "StudyRoom"
	this.descrip ="You entered a study room. There is an old desk in front of you, but mysteriously no chairs.  Perhaps the old owner of this place went to school?";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
}

//END OBJECT DEFINITIONS


var roomList = [new StudyRoom(),new StudyRoom(),new StudyRoom(), new MovieTheatre(),
				new ConanRoom(), new sitting_room(), new sitting_room(), new hallway(),new hallway(),
				new hallway()];

//shuffles the list of rooms
function shuffleRoomList(){
	for(var i = 0;i<roomList.length;i++){
		var r1 = Math.floor(Math.random()*roomList.length);
		swap(i,r1);
	}
	function swap(index1, index2){
		var temp = roomList[index1];
		roomList[index1] = roomList[index2];
		roomList[index2] = temp;
	}
}
shuffleRoomList(); // just call shuffle immediately
//rotates a room by changing its legal directions and facing value
//the rotation is to the right (eg NORTH becomes EAST)
function rotate(room){
	//inner function for rotating a direction
	function rotateDir(direction){
		switch(direction){
			case "NORTH": return "EAST";
			case "EAST": return "SOUTH";
			case "SOUTH": return "WEST";
			case "WEST": return "NORTH";
			default: return direction;
		}
	}
	room.facing = rotateDir(room.facing);
	for(var i = 0;i<room.legal_directions.length;i++){
		room.legal_directions[i] = rotateDir(room.legal_directions[i]);
	}
}

//sets up all of the map data and stores it in mapdata
function generateMapData(){
	var mapdata = new Array();
	var addedAlready = [];
	//iterate through rooms and add them to the map
	//direction field in this function is used to ignore the backwards when iterating
	function addData(room,direction, arr){
		//add this room's data
		var thisRoom = new (function(){}); //create an empty object
		thisRoom.name = room.name;
		var oppDirec = getOpDirection(direction);
		thisRoom.coords = room.coords;
		thisRoom.legal_directions = room.legal_directions;
		thisRoom.players = getPlayersInRoom(room);
		arr[arr.length] = thisRoom; //add this room to arr
		//where room data is basically a string with a few added fields
		/* The problem was that when rooms get joined on multiple sides, it allows this snaking around effect
		some how we need to not call addData on rooms that are already in the roomlist*/
		for(var i = 0;i<room.legal_directions.length;i++){
			if(room[room.legal_directions[i]] != null && room.legal_directions[i] != oppDirec && room[room.legal_directions[i]] != null 
				&& addedAlready.indexOf(room[room.legal_directions[i]].coords.toString())<0 ){
				addedAlready.push(room[room.legal_directions[i]].coords.toString());
				addData(room[room.legal_directions[i]], room.legal_directions[i], arr);
			}
		}
	}
	addData(start, "none", mapdata);
	return mapdata;
}

//finds all of the players within a specific room
function getPlayersInRoom(room){
	var pls = new Array();
	for(var i = 0; i <players.length;i++){
		if(playerObjects[players[i]].location == room){
			pls.push(players[i]);
		}
	}
	return pls;
}

//generates coordinates for an adjacent room based on old room and direction
function getCoords(oldRoom, direction){
	var coords = oldRoom.coords.slice(0);
	switch(direction){
		case "NORTH": coords[1]++; break;
		case "EAST": coords[0]++;break;
		case "SOUTH": coords[1]--;break;
		case "WEST": coords[0]--;break;
		default: //do nothing
	}
	return coords;
}

//returns a room if there is one at the given coordinates
function getRoomAtCoord(coords){
	for(var i = 0;i<rooms_in_play.length;i++){
		if(rooms_in_play[i].coords.toString() == coords.toString()){
			return rooms_in_play[i];
		}
	}
	return null;
}

//connects this room to any adjacent rooms
function connect(room){
	for(var i = 0;i<room.legal_directions.length;i++){
		var dir = room.legal_directions[i];
		var coords = getCoords(room, dir);
		//console.log(coords);
		var temp_room = getRoomAtCoord(coords);
		//console.log("room at coords = "+temp_room.name
		//console.log("\nAbout to check in connect\n");
		if(temp_room != null && temp_room.legal_directions.indexOf(getOpDirection(dir))>-1){
			//connect it with this room
			room[dir] = temp_room;
			temp_room[getOpDirection(dir)] = room;
			//var str = formatString("room = $v\ntemp_room = $v\n",room.name,temp_room.name);
			//console.log(str);
			//console.log("\nOp direction = "+getOpDirection(dir)+"\n");
		}
	}
	console.log("Connection done");
}

//grabs a random string from an array
function getRandomDirection(arr){
	var rand = Math.floor(Math.random()*arr.length);
	return arr[rand];
}
//returns the opposite of a given direction (eg; op(north) = south)
function getOpDirection(direction){
	switch(direction){
		case "NORTH": return "SOUTH";
		case "SOUTH": return "NORTH";
		case "WEST": return "EAST";
		case "EAST": return "WEST";
		case "UP": return "DOWN";
		case "DOWN": return "UP";
		default: return "none";
	}
}

//main function for processing user input
function processMessage(username,message,socket){
	//socket.emit('recieveMsg', "[Server]You sent a special message");
	
	if(message.length > 4 && message.slice(0,4) == "/go "){
		movePlayer(username,message.slice(4),socket);
	}else if(message.indexOf("inventory")>-1){
		var currPlayer = playerObjects[username];
		var inventory = currPlayer.inventory;
		if(inventory.length == 0){
			printToSocket("Your inventory is empty.",socket);
		}else{
			printToSocket("Inventory:\n"+inventory.toString(),socket);
		}
	}else if(message.indexOf("stats")){
		printPlayerStats(username,socket);
	}else{
		printToSocket('Command: "'+message+'" not understood.',socket);
	}
}

//helper function for processMessage
function hasKeyWords(){

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
function printPlayerStats(username, socket){
	//message = "Your character has been created.\nHealth: "+playerObjects[username].health;
	message = formatString("Name: $v\nHealth: $v\nLocation: $v",
	username,playerObjects[username].health,playerObjects[username].location.name);
	socket.emit('recieveMsg', message);
}

//simple function for sending a message to a socket
function printToSocket(msg, socket){
	socket.emit('recieveMsg', msg);
}
//simple format string function that replaces '$v' with the corrosponding variable passed in
function formatString(string){
	for(var i = 1;i<arguments.length;i++){
		temp = string.slice(0,string.indexOf("$v")+2);
		temp = temp.replace("$v",arguments[i]);
		string = temp+string.slice(string.indexOf("$v")+2);
	}
	return string;
}

//Moves the player if possible and sends out the appropriate messages
//and triggers events if nessecary
//can pass in direction = "none" to 're-enter' into the existing location
function movePlayer(username,direction,socket){
	var player = playerObjects[username];
	if(direction == "none"){ //re-enter same room
		newRoom = player.location;
	}else{
		newRoom = player.location[direction]
	}
	if(newRoom == null){
		//check if it is legal to create a room here. If not, then tell the player that they cannot move there
		var new_coords = getCoords(player.location,direction);
		//going to put check for room collision here
		if(player.location.legal_directions.indexOf(direction)>-1 && getRoomAtCoord(new_coords) == null){
			//make a new room
			
			poppedRoom = roomList.pop();
			if(poppedRoom == null){
				printToSocket("That door is utterly locked and cannot possibly be opened.", socket);
				return;
			}
			//now attach the new room to the old room
			//player.location[direction] = poppedRoom;
			//Check if we need to rotate the new room to make its entrance line up
			var opDir = getOpDirection(direction);
			//assume every room as at least one NSEW entrance
			while(poppedRoom.legal_directions.indexOf(opDir)<0){
				rotate(poppedRoom);
			}
			//poppedRoom[opDir] = player.location
			//now set coords for poppedRoom
			poppedRoom.coords = getCoords(player.location,direction);
			//connect poppedRoom with the rest of the house
			connect(poppedRoom);
			rooms_in_play.push(poppedRoom); //add room to the rooms in play list for later
			//now retry the move
			movePlayer(username,direction,socket);
		}else
			printToSocket("You cannot go "+direction,socket);
	}else{
		player.location = newRoom;
		printToSocket(newRoom.descrip,socket);
		printToSocket("You are facing "+newRoom.facing, socket);
		socket.emit('updateRoomData', newRoom.name);	//update player's room picture
		var mapdata = generateMapData();
		socket.emit('updateMapData', mapdata);	//update player's minimap
		socket.broadcast.emit('updateMapData', mapdata);	//update player's minimap
		//printToSocket("coords= "+newRoom.coords,socket);
	}
}

//begin server-side functions that respond to client
	io.sockets.on('connection', function (socket) {
	
		socket.on('try_connect', function (username) {
			players[players.length] = username;
			playerObjects[username] = new player(username); //construct a new player object
			socket.emit('connected', players);
			socket.broadcast.emit('other_connected', players);
			printPlayerStats(username, socket);
			movePlayer(username,"none",socket);
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
