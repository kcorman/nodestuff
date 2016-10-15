//Server-app for "Escape from the Haunted House"
//Created by Kenny Corman
//began project on 12/27/2012

var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs')

app.listen(8080);

//************************************** GAME-STATE VARIABLES *****************************************
var started = false;
var players = new Array();
var playerObjects = {}; //hash set for player names with player objects
var start = new room("GreatHall");start.descrip = "You are inside a dusty old entrance hall.";
var rooms_in_play = [start]; //list of all the rooms currently in play
var monstersInPlay = []; 
var turn_timer = 0; 
var turn_length = 20;
var game_modes = [new escape()];
var game_mode = game_modes[0];

//"shoe" that holds rooms. When a player moves, a room is popped from this list and put into play
var roomList = [new StudyRoom(),new StudyRoom(),new StudyRoom(), new MovieTheatre(),
				new ConanRoom(), new sitting_room(), new sitting_room(), new hallway(),new hallway(),
				new hallway(), new Graveyard(), new BackDoor(), new SurgeryRoom()];
shuffleRoomList(); // just call shuffle immediately
//shoe that holds items.
var itemList = [new flask(), "Broken Bottle", "Jafar Plush Toy", "Rusty Chain", new key("Red"), new key("Blue"), new key("Yellow")];


//**************************************** END GAME-STATE VARIABLES **************************************

setInterval(function(){updateGame()},1000);

//OBJECT DEFINITIONS

//player object definition
function player(name){
	this.name = name;
	this.health = 10;
	this.location = start;
	this.inventory = ["Stale Bread",new flask()];
	this.alive = true;
	this.moves = 3;
	this.speed = 3;
	this.socket;
	this.weapon = "Fist";
	this.damage = "2";
	this.attack = function(target){
		printToSocket("You attacked the "+target+" with your "+this.weapon.toString()+"!",this.socket);
		target.takeDamage(this.damage,this.name);
	}
	this.moveCheat = false; //pervents moves from being used up
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

//Game mode definition
function escape(){
	//the tick function is called every time the game state is periodically updated(every second)
	this.tick = function(){
		//do nothing
	}
	
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"unlock")){
			var player = playerObjects[username];
			var inv = player.inventory;
			var keyCount = 0;
			for(var i = 0;i<inv.length;i++){
				if(inv[i].name == "Key"){
					keyCount++;
				}
			}
			if(keyCount >= 3){
				printToSocket("You unlocked the house and escaped safely. You win!",socket);
				socket.broadcast.emit(username+" has unlocked the house and gotten to safety. But as a result, the house has trapped you in.\nGame Over");
			}else{
				printToSocket("You do not have all of the keys.",socket);
			}
			return true;
		}
		return false;
	}
}

//================================================= ROOM DEFINITIONS =================================================
function sitting_room(){
	this.name = "SittingRoom"
	this.descrip = "A spooky sitting room";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
	this.itemsInRoom = [];
	this.drawer_open = false;
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"drawer")){
			if(this.drawer_open){
				printToSocket("The desk drawer is already open.",socket);
				return true;
			}else{
				this.drawer_open = true;
				var item = itemList.pop();
				this.itemsInRoom.push(item);
				printToSocket("You slowly open the drawer. Crammed into it you see a "+item+".",socket);
				return true;
			}
		}else if(hasKeyWords(message,"search")){
			if(this.drawer_open){
				printToSocket("You see an old desk, but the drawer is already open and there is nothing in it.",socket);
			}else{
				printToSocket("You see an old desk with drawers that appear to open.",socket);
			}
			return true;
		}
		return false;
	}
}

function SurgeryRoom(){
	this.name = "SurgeryRoom"
	this.descrip = "You have entered what appears to be a surgery room. Who knows what kind of horrific experiments went on here...";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","SOUTH"];
	this.itemsInRoom = [new BagOfBlood()];
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"search")){
			printToSocket("There is an old surgery table which is too heavy to move, and a bag of blood, possibly used in a failed attempt to keep something alive.",socket);
			return true;
		}
		return false;
	}
}

function BackDoor(){
	this.name = "BackDoor"
	this.descrip = "At the end of a chilling hallway you found a big door. You feel a draft coming around the edges of it.";
	this.facing = "NORTH";
	this.legal_directions = ["SOUTH"];
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"search")){
			printToSocket("There's a door... duh.",socket);
			return true;
		}else if(hasKeyWords(message,"open","door")){
			printToSocket("The door is rusty, but after pushing with all of your manly might, it swings open enough for you to"+
			" ooze yourself out like the slimey creature you are. You may now continue onward.",socket)
			this.name = "BackDoorOpen";
			this.legal_directions.push(getRelativeDirection(this.facing,"NORTH"));
			connect(this);
			socket.emit('updateMapData', generateMapData());	//update player's minimap
			return true;
		}
		return false;
	}
}

function Graveyard(){
	this.name = "Graveyard"
	this.descrip = "You walked out into a graveyard. As if a creepy old house wasn't enough, you are now standing on top of burried bodies. Good job.";
	this.facing = "NORTH";
	this.legal_directions = ["SOUTH"];
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"search")){
			printToSocket("There are a couple of unmarked tombstones leaning against the house, perhaps being saved"+
			" for somebody. There is also a little wall around the graveyard in front of you which could possibly be jumped.",socket);
			return true;
		}else if(hasKeyWords(message,"jump", "fence")){
			playerObjects[username].alive = false;
			printToSocket("You jumped the fence of the graveyard, and you are now FREE! No wait, you landed in an open grave and got eaten by a zombie.", socket);
			killPlayer(username,socket);
			return true;
		}
	}
}

function hallway(){
	this.name = "SpookyHallway"
	this.descrip = "A spooky hallway room. Perhaps an old witch used to beat up kittens here.";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
	this.hasItem = getPercentChance(40);
	this.itemsInRoom = [];
	this.processMessage = function(username, message, socket){
		
		if(hasKeyWords(message,"search")){
			if(this.hasItem){
				this.hasItem = false;
				var item = itemList.pop();
				this.itemsInRoom.push(item);
				printToSocket("Against all odds, you searched a seemingly empty hallway and found a "+item.toString(),socket);
				return true;
			}else{
				printToSocket("You searched all around, but all you have to show for it is hair full of spiderwebs.",socket);
				return true;
			}
		}
	}
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
	this.monstersInRoom = [];
	this.spawnedMonster = false;
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"search")){
			if(this.spawnedMonster == false){
				printToSocket("After checking under the seats, you notice that one of them appears to be occupied...",socket);
				var monster = new ghost();
				spawnMonster(this,monster,username);
			}else{
				printToSocket("After checking under the seats, you notice nothing of interest.",socket);
			}
			return true;
		}
		return false;
	}
}

function StudyRoom(){
	this.name = "StudyRoom"
	this.descrip ="You entered a study room. There is an old desk in front of you, but mysteriously no chairs.  Perhaps the old owner of this place went to school?";
	this.facing = "NORTH";
	this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
	this.spawnedMonster = false;
	this.monstersInRoom = [];
	this.processMessage = function(username, message, socket){
		if(hasKeyWords(message,"search")){
			if(this.spawnedMonster == false){
				printToSocket("Thump thump thump.. as you were looking under the desk, you turned around and saw a ZOMBIE...",socket);
				var monster = new zombie();
				spawnMonster(this,monster,username);
				//updateGraphics(username,socket);
			}else{
				printToSocket("You found nothing interesting.",socket);
			}
			return true;
		}
		return false;
	}
}

//============================================== END ROOM DEFINITIONS =================================================

//============================================ ITEM DEFINITIONS ==================================================
function flask(){
	this.name = "Flask"
	this.contents = "Water";
	this.contentsHp = 1;
	this.toString =
	function toString(){
		return this.name+" of "+this.contents;
	};
	this.processMessage = 
	function processMessage(username,message,socket){
		if(hasKeyWords(message,"drink",this.name,this.contents)){
			printToSocket(formatString("You drank the $v.\nYou gained $v health but now have to pee.",this.contents,this.contentsHp),socket);
			playerObjects[username].health++;
			//playerObjects[username].inventory = removeByValue(playerObjects[username].inventory, this);
			removeByValue(playerObjects[username].inventory, this);
			return true;
		}
		return false; //return false so global psMsg can continue
	};
}

function key(color){
	this.name = "Key";
	this.color = color;
	this.toString = function(){
		return this.color+" "+this.name;
	}
}

function BagOfBlood(){
	this.name = "Bag of Blood";
	this.image = new function(){};
	this.image.name = "BagOfBlood";
	this.image.x = 0;
	this.image.y = 0;
	this.toString = function(){
		return this.name;
	}
}

//======================================== END ITEM DEFINITIONS ==================================================

//======================================== MONSTER DEFINITIONS ==================================================
function zombie(){
	this.name = "Zombie";
	this.image = new function(){};
	this.image.name = this.name;
	this.image.x = 0;
	this.image.y = 0;
	this.attackPower = 4;
	this.onSpawn = "AHH! A ZOMBIE! A freaky weird greenish gooey droopy zombie has popped out. It looks dangerous!";
	this.onEntry = "A zombie has entered the room. Everybody be cool.";
	this.location;
	this.toString = function(){ return this.name};
	this.health = 10;
	this.takeDamage = function(dmg,username){
		this.health-=dmg;
		if(this.health<1){
			printToSocket('The zombie is dead... again.',playerObjects[username].socket)
			killMonster(this);
		}else{
			printToSocket('The attack was successful. The zombie took '+dmg+' damage.',playerObjects[username].socket)
		}
	}
	
	this.attack = function(){
		var localPlayers = getPlayersInRoom(this.location);
		for(var i = 0;i<localPlayers.length;i++){
			var socket = playerObjects[localPlayers[i]].socket;
			printToSocket("The "+this.name+" attacks you. You take "+this.attackPower+" damage.",socket);
			playerObjects[localPlayers[i]].health -= this.attackPower;
		}
	};
	this.move = function(){
		//if there are players in the room, attack
		if(getPlayersInRoom(this.location).length > 0){
			this.attack();
		//else chase a target if it has one
		}else if(this.target != null){
			var path = getPath(this.location,this.target.location);
			if(path.length>0){
				moveMonster(this,path[0]);
				this.attack();
			}
		}
	}
	monstersInPlay.push(this);
}
function ghost(){
	this.name = "Ghost";
	this.image = new function(){};
	this.image.name = this.name;
	this.image.x = 0;
	this.image.y = 0;
	this.attackPower = 3;
	this.toString = function(){ return this.name};
	this.onSpawn = "A ghost! Yikes! Some ghosts are harmless. But only some...";
	this.onEntry = "A ghost has floated through the wall.";
	this.location;
	this.attack = function(){
		var localPlayers = getPlayersInRoom(this.location);
		for(var i = 0;i<localPlayers.length;i++){
			var socket = playerObjects[localPlayers[i]].socket;
			printToSocket("The "+this.name+" attacks you. You take "+this.attackPower+"damage.",socket);
			playerObjects[localPlayers[i]].health -= this.attackPower;
		}
	};
	this.takeDamage = function(dmg,username){
		printToSocket('The attack has no effect on the ghost.',playerObjects[username].socket)
	}
	this.move = function(){
		//if there are players in the room, attack
		if(getPlayersInRoom(this.location).length > 0){
			this.attack();
		//else chase a target if it has one
		}else if(this.target != null){
			var path = getPath(this.location,this.target.location);
			if(path.length>0){
				moveMonster(this,path[0]);
			}
		}
	}
	monstersInPlay.push(this);
}
//==================================== END MONSTER DEFINITIONS ==================================================
//END OBJECT DEFINITIONS

//======================================== MISC FUNCTIONS =====================================================


//this function removes an object from an array, by value
function removeByValue(arr) {
	//CAUTION: this function probably has side effects and there might be something in the code that wasn't updated to work with them
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax= arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

//prints to the players within a room
function printToLocalPlayers(message,location){
	var players = getPlayersInRoom(location);
	for(var i =0;i<players.length;i++){
		var obj = playerObjects[players[i]];
		var socket = obj.socket;
		printToSocket(message, socket);
	}
}

//moves a monster in the specified direction
function moveMonster(mons,dir){
	var currRoom = mons.location;
	//remove monster from currRoom
	removeByValue(currRoom.monstersInRoom,mons);
	var dest = currRoom[dir];
	if(dest.monstersInRoom == null){
		dest.monstersInRoom = [];
	}
	dest.monstersInRoom.push(mons);
	mons.location = dest;
	printToLocalPlayers(mons.onEntry,mons.location); 
}


//terminates a player character
function killPlayer(username,socket){
	printToSocket("You are DEAD. Game over, man.",socket);
	playerObjects[username].alive = false;
	playerObjects[username].location.descrip += "\nYou smell something fowl... what could it be? Oh, it's "+username+"'s corpse.";
}
function killMonster(mons){
	var currRoom = mons.location;
	//remove monster from currRoom
	removeByValue(currRoom.monstersInRoom,mons);
	removeByValue(monstersInPlay,this);
}
//returns an array of strings representing movements needed to get from loc. a to loc.b
function getPath(locA, locB){
	console.log("\nFunction called\n");
	var currPath = [];
	tryPath(locA, locB, currPath, []);
	//for(var i = 0;i<currPath.length;i++){
	//	console.log("\n"+currPath[i].name+"\n");
	//}
	console.log("\n"+currPath.toString());
	//this function returns a path of rooms from loca to locB
	function tryPath(locA, locB, curr,tried){
		tried.push(locA);
		if(locA == locB){
			//curr.push(locA);
			return true;
		}else{
			for(var i = 0;i<locA.legal_directions.length;i++){
				if(locA[locA.legal_directions[i]] != null && tried.indexOf(locA[locA.legal_directions[i]])<0){
					if(tryPath(locA[locA.legal_directions[i]],locB,curr,tried)){
						curr.push(locA.legal_directions[i]);
						return true;
					}
				}
			}
		}
		return false;
	}
	return currPath.reverse();
}

//this function returns the direction from roomA to roomB
function getDirectionFromRoom(roomA, roomB){
	for(var i =0;i<roomA.legal_directions.length;i++){
		
	}
}

//this function is the implementation of a cheat code made for speeding up debugging
function debugMode(username,socket){
	playerObjects[username].moveCheat = true;
	printToSocket("Debug mode activated.",socket);
}

//this function returns true or false, with a %chance to return true equal to the argument
function getPercentChance(perc){
		var rand = Math.floor(Math.random()*100)+1;
		return rand<=perc;
}

//this function spawns a monster in a room
//player argument is optional; the monster will set it as the target
function spawnMonster(room,monster, username){
	if(room.monstersInRoom == null){
		room.monstersInRoom = [];
	}
	room.monstersInRoom.push(monster);
	monster.location = room;
	monster.target = playerObjects[username];
	room.spawnedMonster = true; //some rooms use this field to know when to stop spawning monsters
	printToLocalPlayers(monster.onSpawn,room);
}
//this function updates the game periodically (turns, etc.)
function updateGame(){
	var endTurn = false;
	//game mode specific code
	game_mode.tick();
	//end game-mode specific code
	turn_timer++;
	if(turn_timer>=turn_length){
		turn_timer = 0;
		//reset amount of moves
		endTurn = true;
		//io.sockets.emit('recieveMsg', 'The turn has ended and a new one has begun');
		//move monsters
		for(var i = 0;i<monstersInPlay.length;i++){
			if(monstersInPlay[i].move != null){ 
				//console.log("moving a monster");
				monstersInPlay[i].move();
			}
		}
	}
	//update graphics and timers
	var timeLeft = turn_length - turn_timer;
	for(var i =0;i<players.length;i++){
		var socket = playerObjects[players[i]].socket;
		if(endTurn){
			playerObjects[players[i]].moves = playerObjects[players[i]].speed;
		}
		socket.emit('updateTimers',playerObjects[players[i]].moves,timeLeft);
		updateGraphics(players[i],socket);
	}
}
//======================================= END MISC FUNCTIONS ==================================================


				
//******************************* ROOM MANAGEMENT FUNCTIONS **************************************************
//
//
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
//shuffleRoomList(); // just call shuffle immediately

//retrieves the relative direction based on a facing direction
function getRelativeDirection(facing, direc){
	if(facing == "EAST"){
		return rotateDir(direc, 1);
	}else if(facing == "SOUTH"){
		return rotateDir(direc,2);
	}else if(facing == "WEST"){
		return rotateDir(direc,3);
	}else {
			return direc;
	}
	
	function rotateDir(direc, num){
		if(num == 0){
			return direc;
		}else{
			switch(direc){
				case "NORTH": return rotateDir("EAST", num-1);
				case "EAST": return rotateDir("SOUTH", num-1);
				case "SOUTH": return rotateDir("WEST", num-1);
				case "WEST": return rotateDir("NORTH", num-1);
				default: return direc;
			}
		}
	}
}
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
		thisRoom.coords = room.coords;
		thisRoom.legal_directions = room.legal_directions;
		thisRoom.players = getPlayersInRoom(room);
		arr[arr.length] = thisRoom; //add this room to arr
		//where room data is basically a string with a few added fields
		/* The problem was that when rooms get joined on multiple sides, it allows this snaking around effect
		some how we need to not call addData on rooms that are already in the roomlist*/
		//console.log("\nadding data for room: "+room.name.toString()+"\nlegal_directions= "+room.legal_directions.toString()+
		//", length= "+room.legal_directions.length);
		for(var i = 0;i<room.legal_directions.length;i++){
			if(room[room.legal_directions[i]] != null && addedAlready.indexOf(room[room.legal_directions[i]].coords.toString())<0 ){
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
	//console.log("Connection done");
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

//*********************************** END ROOM MANAGEMENT FUNCTIONS **************************************

//=================================== USER INPUT ==============================================
//main function for processing user input
function processMessage(username,message,socket){
	//socket.emit('recieveMsg', "[Server]You sent a special message");
	if(playerObjects[username].alive == false){
		printToSocket("You are dead. You cannot do anything.",socket);
	}else if(hasKeyWords(message,"test_path")){
		getPath(start,playerObjects[username].location);
	}else if(message == '/g'){
		debugMode(username,socket);
	}else if(message.length > 4 && message.slice(0,4) == "/go "){
		movePlayer(username,message.slice(4),socket);
	}else if(hasKeyWords(message,"inventory")){
		var currPlayer = playerObjects[username];
		var inventory = currPlayer.inventory;
		if(inventory.length == 0){
			printToSocket("Your inventory is empty.",socket);
		}else{
			printToSocket("Inventory:\n"+inventory.toString(),socket);
		}
	}else if(hasKeyWords(message,"stats","health","hp","status")){
		printPlayerStats(username,socket);
	}else if(message.length > 5 && message.slice(0,5) == "/eat "){
		var food = message.slice(5);
		//check if food matches the name of something in the inventory
		var currPlayer = playerObjects[username];
		var inv = playerObjects[username].inventory;
		if(inv.toString().indexOf(food)>-1){
			if(food == "banana"){
				currPlayer.health++;
				printToSocket("You ate the "+food+" and regained some health.",socket);
				currPlayer.inventory = removeByValue(inv,food);
			}else{
				//currPlayer.health--;
				//printToSocket("You ate the "+food+" and now you don't feel so good.");
				//currPlayer.inventory = removeByValue(inv,food);
				printToSocket("You probably shouldn't eat that.",socket);
			}
		}else{
			printToSocket("Eat what?",socket);
		}
	}else if(hasKeyWords(message,"take","grab","pick up")){
			//for item pick up
			var currRoom = playerObjects[username].location;
			var itemsInRoom = currRoom.itemsInRoom
			if(itemsInRoom != null && itemsInRoom.length>0){
				var itemToTake;
				//the following code is long because it trys to pick up specifically what the player wants if there are
				//several items in the room
				for(var i = 0;i<itemsInRoom.length;i++){
					if(hasKeyWords(message, itemsInRoom[i].name)){
						itemToTake = itemsInRoom[i];
					}
				}
				//if no item matches the message, just pick the top one
				if(itemToTake == null){
					itemToTake = itemsInRoom[0];
				}
				//remove the item from the itemlist and put it in the player's inventory
				removeByValue(itemsInRoom,itemToTake);
				playerObjects[username].inventory.push(itemToTake);
				printToSocket("You picked up the "+itemToTake+".",socket);
				
			}else{
				printToSocket("There is nothing to take.",socket);
			}
			return true;
		}else if(hasKeyWords(message,"attack")){
			var player = playerObjects[username];
			//find target
			var target = null;
			var monstersInRoom = player.location.monstersInRoom;
			for(var i = 0;i<monstersInRoom.length;i++){
				var mons = monstersInRoom[i];
				if(hasKeyWords(message, mons.toString())){
					target = mons;
				}
			}
			if(target != null){
				player.attack(target);
			}else{
				printToSocket("Attack what?",socket);
			}
		}else{
		//check if any items can process the message
			var inventory = playerObjects[username].inventory;
			for(var i = 0;i<inventory.length;i++){
				if(typeof inventory[i].processMessage === 'function'){

					if(inventory[i].processMessage(username,message,socket)){
						return;
					}
				}
			}
			//if one of the items processed the message, we will not get here
			var currRoom = playerObjects[username].location;
			if(typeof currRoom.processMessage === 'function'){
				if(currRoom.processMessage(username,message,socket)){
					return;
				}
			}
			//check if any monsters can process this message
			var currRoom = playerObjects[username].location;
			var monstersInRoom = currRoom.monstersInRoom
			if(monstersInRoom != null){
				for(var i=0;i<monstersInRoom.length;i++){
					if(typeof monstersInRoom[i].processMessage === 'function'){
						if(monstersInRoom[i].processMessage(username,message,socket)){
							return;
						}
					}
				}
			}
			
			//check if the game_mode can process this message
			if( typeof game_mode.processMessage === 'function'){
				if(game_mode.processMessage(username,message,socket)){
					return;
				}
			}
			
			printToSocket('Command: "'+message+'" not understood.',socket);
	}
}

//helper function for processMessage
//returns true if the given message has any of the arguments as keywords
function hasKeyWords(message){
	for(var i = 1;i<arguments.length;i++){
		if(message.indexOf(arguments[i])>-1){
			return true;
		}
	}
	return false;
}

//================================================ END USER INPUT =================================================

//============================================GRAPHICS HANDLING ===================================
//graphics come from a few sources:
//Room picture
//item picture
//monster picture
//playerObject picture
//so to find out what graphics to display, we just check with the client's player's rooms and items
//as well as the monsters and potential players within the room
//graphics are actually strings representing the image name, x,y coordinates, and width/height
function updateGraphics(username, socket){
	var gfx = []; //empty array
	var player = playerObjects[username];
	var currRoom = player.location;
	gfx[0] = new function(){};
	gfx[0].name = currRoom.name;
	gfx[0].x = 0;
	gfx[0].y = 0;
	var index = 1; //gfx index
	//now add any item pictures
	var items = currRoom.itemsInRoom;
	if(items != null){
		for(var i=0;i<items.length;i++){
			if(items[i].image != null){
				gfx[index] = new function(){};
				gfx[index].name = items[i].image.name;
				gfx[index].x = items[i].image.x;
				gfx[index].y = items[i].image.y;
				index++;
			}
		}
	}
	//now add any monster pictures
	var monsters = currRoom.monstersInRoom;
	if(monsters != null){
		for(var i=0;i<monsters.length;i++){
			if(monsters[i].image != null){
				gfx[index] = new function(){};
				gfx[index].name = monsters[i].image.name;
				gfx[index].x = monsters[i].image.x;
				gfx[index].y = monsters[i].image.y;
				index++;
			}
		}
	}
	socket.emit('updateGraphics', gfx);
	
}
//==========================================END GRAPHICS HANDLING =================================
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
	if(player.moves < 1){
		printToSocket("You cannot move anymore this turn.", socket);
		return;
	}
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
			if(playerObjects[username].moveCheat == false){
				playerObjects[username].moves = 1; //essentially removing the remaining moves for the turn (when this method gets called again, they will lose the last move)
			}
			movePlayer(username,direction,socket);
		}else
			printToSocket("You cannot go "+direction,socket);
	}else{
		player.location = newRoom;
		if(playerObjects[username].moveCheat == false)
			player.moves--;
		printToSocket(newRoom.descrip,socket);
		printToSocket("You are facing "+newRoom.facing, socket);
		//socket.emit('updateRoomData', newRoom.name);	//update player's room picture
		updateGraphics(username,socket);
		var mapdata = generateMapData();
		socket.emit('updateMapData', mapdata);	//update player's minimap
		socket.broadcast.emit('updateMapData', mapdata);	//update player's minimap
		//printToSocket("coords= "+newRoom.coords,socket);
	}
}

//********************************************* CLIENT RESPONSE FUNCTIONS ********************************************
	io.sockets.on('connection', function (socket) {
	
		socket.on('try_connect', function (username) {
			players[players.length] = username;
			playerObjects[username] = new player(username); //construct a new player object
			playerObjects[username].socket = socket;
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
// ******************************************* END CLIENT RESPONSE FUNCTIONS *********************************
