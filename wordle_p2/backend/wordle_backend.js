/**
 * read    GET - Safe, Idempotent, Cachable
 * update  PUT - Idempotent
 * delete  DELETE - Idempotent
 * create  POST
 *
 * https://restfulapi.net/http-methods/
 * https://restfulapi.net/http-status-codes/
 *
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
 * https://restfulapi.net/rest-put-vs-post/
 **/

const port = 8210;
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const fs = require('fs');
const Wordle = require("./model.js");
app.use(cookieParser());

const database = {};
var words = ["words"]; // just in case!!
let randomWord;

var staticPort = 8211;
var webSocketPort = staticPort + 1;

var connectedPlayers = [];
let firstWinnerOfRound = null;

/******************************************************************************
 * word routines
 ******************************************************************************/

// Read in all words, lets hope this finished before we need the words!
// https://www.memberstack.com/blog/reading-files-in-node-js
fs.readFile('./words.5', 'utf8', (err, data) => {
	if (err) {
		console.error(err);
		return;
	}
	words = data.split("\n");
	initNextResetTimeAndUpdateWord();
});

/******************************************************************************
 * middleware
 ******************************************************************************/
app.use(express.json()); // support json encoded bodies
app.use(express.urlencoded({ extended: true })); // support encoded bodies

app.use('/', express.static('static_files')); // this directory has files to be returned

// https://expressjs.com/en/starter/static-files.html
// app.use(express.static('static-content')); 

function getRandomWord(wordsArray) {
	return wordsArray[Math.floor(Math.random() * wordsArray.length)];
}

let nextResetTime;  // Holds the timestamp of the next reset
const resetInterval = (5 * 60 * 1000) + 30 * 1000; // 5 minutes

const initNextResetTimeAndUpdateWord = () => {
	nextResetTime = Date.now() + resetInterval;
	randomWord = getRandomWord(words);
	console.log(`The random word has been updated to: ${randomWord}`);
};

setInterval(() => {
	nextResetTime = Date.now() + resetInterval;

	for (let username in database) {
		if (database.hasOwnProperty(username)) {
			database[username].reset(randomWord);
		}
	}
	firstWinnerOfRound = null;
	initNextResetTimeAndUpdateWord();
}, resetInterval);


/******************************************************************************
 * Socket
 ******************************************************************************/

var WebSocketServer = require('ws').Server
	, wss = new WebSocketServer({ port: webSocketPort });

wss.on('close', function (code, data) {
	const reason = data.toString();
	console.log('disconnected');
});

wss.broadcast = function (message) {
	for (let ws of this.clients) {
		ws.send(message);
	}

	// Alternatively
	// this.clients.forEach(function (ws){ ws.send(message); });
}

wss.on('connection', function (ws) {
	ws.send(JSON.stringify({
        type: 'player-list-update',
        players: connectedPlayers
    }));

	var i;
	for (i = 0; i < connectedPlayers.length; i++) {
		ws.send(connectedPlayers[i]);
	}

	ws.on('message', function (data, isBinary) {
		try {
			const message = isBinary ? data : data.toString();
			const messageData = JSON.parse(message);
			if (!firstWinnerOfRound && messageData.action === "gameResult" && messageData.result === "won") {
				firstWinnerOfRound = messageData.username;
				const firstWins = database[firstWinnerOfRound].getWins();
				const firstLosses = database[firstWinnerOfRound].getLosses();
				wss.broadcast(JSON.stringify({
					type: "first-winner",
					username: firstWinnerOfRound,
					firstWins: firstWins,
					firstLosses: firstLosses
				}));
			}
		} catch (error) {
			const message = isBinary ? data : data.toString();
			if (message === "Clear-Players") {
				connectedPlayers = []; // Clear the connected players list
				// Broadcast the empty player list to all connected clients
				wss.broadcast(JSON.stringify({
					type: 'player-list-update',
					players: connectedPlayers
				}));
			} else {
				// ws.send(message); 
				if (!connectedPlayers.includes(message)) {
					connectedPlayers.push(message);
					// Broadcast the updated player list to all connected clients
					wss.broadcast(JSON.stringify({
						type: 'player-list-update',
						players: connectedPlayers
					}));
				}
			}
		}
	});

	const sendTimeLeft = () => {
		const currentTime = Date.now();
		const timeLeft = Math.max(nextResetTime - currentTime, 0); // Ensure timeLeft is not negative
		ws.send(JSON.stringify({
			type: "time-update",
			timeLeft
		}));
	};

	// Send time update to connected client immediately and every second thereafter
	sendTimeLeft();
	const timeInterval = setInterval(sendTimeLeft, 1000);

	ws.on('close', () => {
		console.log("Client disconnected");
		clearInterval(timeInterval); // Clear the interval on client disconnect
	});
});

/******************************************************************************
 * routes
 ******************************************************************************/
app.get('/api/username/', function (req, res) {
	let username;
	if (req.cookies.username) {
		username = req.cookies.username;
	} else {
		let wordle = new Wordle(words);
		username = wordle.getUsername();
		res.cookie('username', username, { maxAge: 1.5 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
	}
	res.status(200);
	res.json({ "username": username });
});

app.put('/api/username/:username/newgame', function (req, res) {
	let username = req.params.username;

	if (!(username in database)) {
		let wordle = new Wordle(words);
		wordle.setUsername(username);
		wordle.setTargetWord(randomWord); // Use the server's word of the day
		database[username] = wordle;
		database[username].state = "play"; // Ensure game state is set to play
	} else {
		// For existing games, reset with the word of the day
		database[username].reset(randomWord); // This assumes your reset method can accept a word argument
		database[username].state = "play";
	}

	res.status(200);
	res.json({ "status": "created" });
});

// Add another guess against the current secret word
app.post('/api/username/:username/guess/:guess', function (req, res) {
	let username = req.params.username;
	let guess = req.params.guess;

	if (!(username in database)) {
		res.status(409);
		res.json({ "error": `${username} does not have an active game` });
		return;
	}
	var data = database[username].makeGuess(guess);
	if (data.success) {
		// Only reveal the correct word if the game has ended
		if (database[username].state === 'won' || database[username].state === 'lost') {
			data.correctWord = randomWord; // Include the correct word
		}
		res.status(200);
		res.json(data);
	} else {
		res.status(400);
		res.json(data); // Use 400 for bad requests, such as an invalid guess
	}
});

app.get('/api/username/:username/stats', function (req, res) {
	let username = req.params.username;
	if (!(username in database)) {
		res.status(404);
		res.json({ "error": `No stats found for ${username}` });
		return;
	}
	let userStats = {
		wins: database[username].won,
		losses: database[username].lost
	};

	res.status(200);
	res.json(userStats);
});

app.listen(port, function () {
	console.log('Example app listening on port ' + port);
});

app.listen(staticPort, function () {
	console.log('Static content on port:' + staticPort);
});