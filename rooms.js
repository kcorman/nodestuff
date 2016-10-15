
//================================================= ROOM DEFINITIONS =================================================
var Rooms = function(parentapp){
	this.app = parentapp;
}

Rooms.prototype = {
	num: 53,
	test_func: function(){
		return app.getNum();
	},
	sitting_room: function(){
		this.name = "SittingRoom"
		this.descrip = "A spooky sitting room";
		this.facing = "NORTH";
		this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
		this.itemsInRoom = [];
		this.drawer_open = false;
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"drawer")){
				if(this.drawer_open){
					app.printToSocket("The desk drawer is already open.",socket);
					return true;
				}else{
					this.drawer_open = true;
					var item = itemList.pop();
					this.itemsInRoom.push(item);
					app.printToSocket("You slowly open the drawer. Crammed into it you see a "+item+".",socket);
					return true;
				}
			}else if(app.hasKeyWords(message,"search")){
				if(this.drawer_open){
					app.printToSocket("You see an old desk, but the drawer is already open and there is nothing in it.",socket);
				}else{
					app.printToSocket("You see an old desk with drawers that appear to open.",socket);
				}
				return true;
			}
			return false;
		}
	},

	SurgeryRoom: function(){
		this.name = "SurgeryRoom"
		this.descrip = "You have entered what appears to be a surgery room. Who knows what kind of horrific experiments went on here...";
		this.facing = "NORTH";
		this.legal_directions = ["EAST","SOUTH"];
		this.itemsInRoom = [new app.BagOfBlood()];
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"search")){
				app.printToSocket("There is an old surgery table which is too heavy to move, and a bag of blood, possibly used in a failed attempt to keep something alive.",socket);
				return true;
			}
			return false;
		}
	},

	BackDoor: function(){
		this.name = "BackDoor"
		this.descrip = "At the end of a chilling hallway you found a big door. You feel a draft coming around the edges of it.";
		this.facing = "NORTH";
		this.legal_directions = ["SOUTH"];
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"search")){
				app.printToSocket("There's a door... duh.",socket);
				return true;
			}else if(app.hasKeyWords(message,"open","door")){
				app.printToSocket("The door is rusty, but after pushing with all of your manly might, it swings open enough for you to"+
				" ooze yourself out like the slimey creature you are. You may now continue onward.",socket)
				this.name = "BackDoorOpen";
				this.legal_directions.push(app.getRelativeDirection(this.facing,"NORTH"));
				app.connect(this);
				app.socket.emit('updateMapData', generateMapData());	//update player's minimap
				return true;
			}
			return false;
		}
	},

	Graveyard: function(){
		this.name = "Graveyard"
		this.descrip = "You walked out into a graveyard. As if a creepy old house wasn't enough, you are now standing on top of burried bodies. Good job.";
		this.facing = "NORTH";
		this.legal_directions = ["SOUTH"];
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"search")){
				app.printToSocket("There are a couple of unmarked tombstones leaning against the house, perhaps being saved"+
				" for somebody. There is also a little wall around the graveyard in front of you which could possibly be jumped.",socket);
				return true;
			}else if(app.hasKeyWords(message,"jump", "fence")){
				app.playerObjects[username].alive = false;
				app.printToSocket("You jumped the fence of the graveyard, and you are now FREE! No wait, you landed in an open grave and got eaten by a zombie.", socket);
				app.killPlayer(username,socket);
				return true;
			}
		}
	},

	hallway: function(){
		this.name = "SpookyHallway"
		this.descrip = "A spooky hallway room. Perhaps an old witch used to beat up kittens here.";
		this.facing = "NORTH";
		this.legal_directions = ["NORTH","EAST","WEST","SOUTH"];
		this.hasItem = app.getPercentChance(40);
		this.itemsInRoom = [];
		this.processMessage = function(username, message, socket){
			
			if(app.hasKeyWords(message,"search")){
				if(this.hasItem){
					this.hasItem = false;
					var item = itemList.pop();
					this.itemsInRoom.push(item);
					app.printToSocket("Against all odds, you searched a seemingly empty hallway and found a "+item.toString(),socket);
					return true;
				}else{
					app.printToSocket("You searched all around, but all you have to show for it is hair full of spiderwebs.",socket);
					return true;
				}
			}
		}
	},

	ConanRoom: function(){
		this.name = "ConanRoom"
		this.descrip = "You have entered the Conan Room. You feel a slight chill crawl up your spine as you gaze into the eyes of the portrait on the western wall.  Who could it be? It feels like it is watching you.";
		this.facing = "NORTH";
		this.legal_directions = ["EAST","SOUTH"];
	},

	MovieTheatre: function(){
		this.name = "MovieTheatre"
		this.descrip = "You find yourself in an old private movie theatre. The rows of empty seats give you the creeps.";
		this.facing = "NORTH";
		this.legal_directions = ["SOUTH"];
		this.monstersInRoom = [];
		this.spawnedMonster = false;
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"search")){
				if(this.spawnedMonster == false){
					app.printToSocket("After checking under the seats, you notice that one of them appears to be occupied...",socket);
					var monster = new ghost();
					app.spawnMonster(this,monster,username);
				}else{
					app.printToSocket("After checking under the seats, you notice nothing of interest.",socket);
				}
				return true;
			}
			return false;
		}
	},

	RoseGarden: function(){
		this.name = "RoseGarden"
		this.descrip = "This is a nice change of scenery: a beautiful rose garden. However, something about these roses doesn't seem quite right...";
		this.facing = "NORTH";
		this.legal_directions = ["SOUTH"];
		this.monstersInRoom = [];
		this.spawnedMonster = false;
		this.calledMonster = false;
		this.timer = 10;
		this.tick = function(){
			if(this.timer < 1 && this.calledMonster){
				var monster = monsterList.popByString('Vampiress');
				app.spawnMonster(this,monster);
				calledMonster = false;
			}else if(calledMonster){
				this.timer--;
			}
		}
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"search")){
				app.printToSocket("Upon closer inspection, you realize that these 'red' roses are actually white, and have been covered in blood. All except one...",socket);
				return true;
			}else if(app.hasKeyWords(message,"water","roses","blood")){
				if(this.spawnedMonster == false){
					var player = playerObjects[username];
					var item = player.inventory.getByString('Bag of Blood');
					if(item != null){ 
						app.printToSocket("You pour the blood on the white rose, and suddenly a chill fills the air.",socket);
						app.removeByValue(player.inventory,item);
						this.name = 'RoseGardenWatered';
						this.calledMonster = true;
					}else{
						app.printToSocket("You do not have the right item to do that.",socket);
						return true;
					}
				}else{
					app.printToSocket("All of the roses are already covered in blood.",socket);
				}
				return true;
			}
			return false;
		}
	},

	StudyRoom: function(){
		this.name = "StudyRoom"
		this.descrip ="You entered a study room. There is an old desk in front of you, but mysteriously no chairs.  Perhaps the old owner of this place went to school?";
		this.facing = "NORTH";
		this.legal_directions = ["EAST","WEST","SOUTH"];
		this.spawnedMonster = false;
		this.monstersInRoom = [];
		this.hasMonster = app.getPercentChance(100);
		this.closetOpen = false;
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,'search')){
				app.printToSocket("The old closet looks like it could be opened.",socket);
				return true;
			}
			if(app.hasKeyWords(message,"open", 'closet')){
				if(this.hasMonster == true && monsterList.getByString('Zombie') != null){
					app.printToSocket("Inside the closet you found a ZOMBIE.",socket);
					var monster = monsterList.popByString('Zombie');
					app.spawnMonster(this,monster,username);
					this.name = "StudyRoomOpen";
					this.closetOpen = true;
					this.hasMonster = false;
					//updateGraphics(username,socket);
				}else if(this.closetOpen == false){
					this.name = "StudyRoomOpen";
					this.closetOpen = true;
					app.printToSocket("You opened the closet, but there is nothing inside.",socket);
				}else{
					app.printToSocket("The closet is already opened.",socket);
				}
				return true;
			}
			return false;
		}
	},

	WitchLair: function(){
		this.name = "WitchLair"
		this.descrip ="You found a creepy dungeon room with stone walls and some old shelves. There is a table in the center of the room.";
		this.facing = "NORTH";
		this.legal_directions = ["EAST","SOUTH"];
		this.spawnedMonster = false;
		this.monstersInRoom = [];
		this.itemsInRoom = [];
		this.time = 0;
		this.timeWait = 10;
		this.witchCall = false;
		this.tick = function(){
			if(this.witchCall){
				if(this.time < this.timeWait){
					if(this.time == 3){
						printToLocalPlayers('A cool voice calls out "Who lit my fire!?\n You hear footsteps.',this);
					}
					this.time++;
				}else if(this.time == this.timeWait){
					this.time++;
					var mons = new app.witch();
					app.spawnMonster(this,mons);
				}
			}
			
			if(this.name == 'WitchLairFire1')
				this.name = 'WitchLairFire2';
			else if(this.name == 'WitchLairFire2')
				this.name = 'WitchLairFire1';
		}
		this.processMessage = function(username, message, socket){
			if(app.hasKeyWords(message,"search")){
					app.printToSocket("The old table has a slight imprint of a heavy pan of some sort, and it is slightly charred. It seems like someone was lighting fires here, perhaps for cooking.",socket);
				return true;
			}else if(app.hasKeyWords(message, 'fire pit', 'wood')){
				if(!this.itemsInRoom.contains("fire pit")){
					this.name = "WitchLairFirePit";
					this.itemsInRoom.push("fire pit");
					app.printToSocket("You have placed the fire pit.",socket);
				}else{
					app.printToSocket("You have already placed the fire pit.",socket);
				}
				return true;
			}else if(app.hasKeyWords(message, 'cauldron')){
				if(this.itemsInRoom.contains('fire pit')){
					if(!this.itemsInRoom.contains('cauldron')){
						this.name = 'WitchLairCauldron';
						this.itemsInRoom.push('cauldron');
						app.printToSocket("You have placed the cauldron.",socket);
					}else{
						app.printToSocket("You have already placed the cauldron.",socket);
					}
				}else{
					app.printToSocket("You must place the fire pit before you can place the cauldron",socket);
				}
				return true;
			}else if(app.hasKeyWords(message, 'light', 'fire')){
				if(this.itemsInRoom.contains('cauldron')){
					this.name = 'WitchLairFire1';
					app.printToSocket("You lit a nice warm fire.",socket);
					this.witchCall = true;
				}else{
					app.printToSocket("You must place the cauldron before lighting a fire.",socket);
				}
				return true;
			}
			return false;
		}
	}
};
module.exports = Rooms;
/*exports.sitting_room= 	sitting_room;
exports.SurgeryRoom= 	SurgeryRoom;
exports.BackDoor=		BackDoor;
exports.Graveyard=		Graveyard;
exports.hallway=		hallway;
exports.ConanRoom=		ConanRoom;
exports.MovieTheatre=	MovieTheatre;
exports.RoseGarden=		RoseGarden;
exports.StudyRoom=		StudyRoom;
exports.WitchLair=		WitchLair;
exports.hi = "hi";*/
//end module

//============================================== END ROOM DEFINITIONS =================================================