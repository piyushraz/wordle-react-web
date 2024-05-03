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

/******************************************************************************
 * word routines
 ******************************************************************************/

// Read in all words, lets hope this finished before we need the words!
// https://www.memberstack.com/blog/reading-files-in-node-js
fs.readFile('./words.5', 'utf8', (err, data) => {
        if (err)console.error(err);
        else words = data.split("\n");
});

/******************************************************************************
 * middleware
 ******************************************************************************/
app.use(express.json()); // support json encoded bodies
app.use(express.urlencoded({ extended: true })); // support encoded bodies

// https://expressjs.com/en/starter/static-files.html
// app.use(express.static('static-content')); 

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
	res.json({"username":username});
});

app.put('/api/username/:username/newgame', function (req, res) {
	let username=req.params.username;

	if(!(username in database)){
		let wordle=new Wordle(words);
		wordle.setUsername(username);
		database[username]=wordle;
	} 
	database[username].reset();

	res.status(200);
	res.json({"status":"created"});
});

// Add another guess against the current secret word
app.post('/api/username/:username/guess/:guess', function (req, res) {
	let username=req.params.username;
	let guess=req.params.guess;

	if(! username in database){
		res.status(409);
		res.json({"error":`${username} does not have an active game`});
		return;
	}
	var data = database[username].makeGuess(guess);
	if (data.success) {
		// Only reveal the correct word if the game has ended
		if (database[username].state === 'won' || database[username].state === 'lost') {
		  data.correctWord = database[username].target; // Include the correct word
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
		res.json({"error": `No stats found for ${username}`});
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
  	console.log('Example app listening on port '+port);
});

