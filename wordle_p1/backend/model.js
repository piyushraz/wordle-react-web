/******************************************************************************
 * misc routines
 ******************************************************************************/
function rand(max) {
  return Math.floor(Math.random() * max);
}

function isEmptyObject(obj){
	return Object.keys(obj).length === 0;
}

/******************************************************************************
 * model routines
 ******************************************************************************/
module.exports = class Wordle {
	constructor(words){
		this.words=words;
		this.username=this.makeUsername();
		this.won=0;
		this.lost=0;
		this.target=this.getRandomWord();
		this.guesses=[];
		this.scores=[];
		this.state="none"; // could be none, won, lost, play
        }

	// Reset the state of this, starting a new game, we don't change our username
	// nor the number of games won or lost
	reset(){
		this.target=this.getRandomWord();
		this.guesses=[];
		this.scores=[];
		this.state="play"; // could be none, won, lost, play
	}

	// Return a random word from words
	getRandomWord(){ return this.words[rand(this.words.length)]; }

	// Return a random two word username
	makeUsername(){
		return this.getRandomWord()+this.getRandomWord();
	}

	setUsername(username){
		this.username=username;
	}

	getUsername(){ return this.username; }

	getState(){ return this.state; }
	
	// guess.length == target.length, 0 means not seen, 1 is seen, 2 is match in wrong place, 3 is match in correct place
	scoreWord(guess_string, target_string){
		var guess = guess_string.split('');
		var target = target_string.split('');
		var score = [];
		for(var i=0;i<guess.length;i++)score.push({"score":1, "char":guess[i]});
	
		// account for exact matches
		for(var i=0;i<guess.length;i++){
			if(guess[i]==target[i]){
				score[i]["score"]=3;
				guess[i]=null;
				target[i]=null;
			}
		}
		// account for inexact matches
		for(var i=0;i<guess.length;i++){
			if(guess[i]===null)continue;
			for(var j=0;j<target.length;j++){
				if(target[j]===null)continue;
				if(guess[i]==target[j]){
					score[i]["score"]=2;
					guess[i]=null;
					target[j]=null;
					break;
				}
			}
		}
		return score;
	}

	makeGuess(guess){
		var result={ "error":"", "success":true };
		if(guess.length!=5){
			result["error"]="guess must be 5 alphabetic characters";
			result["success"]=false;
			return result;
		}
	
		if(!this.words.includes(guess)){
			result["error"]="guess must be a word";
			result["success"]=false;
			return result;
		}
	
		if(this.state!="play"){
			result["error"]="no guesses allowed for this game";
			result["success"]=false;
			return result;
		}
	
		if(this.guesses.length>5){
			result["error"]="no more guesses allowed for this game";
			result["success"]=false;
			return result;
		}
	
		var target = this.target;
	
		this.guesses.push(guess);
		this.scores.push(this.scoreWord(guess, target));
	
		if(target==guess){
			this.won+=1;
			this.state="won";
		} else if(this.guesses.length==6){
			this.lost+=1;
			this.state="lost";
		}
		result["state"]=this.state;
		result["guess"]=guess;
		result["score"]=this.scoreWord(guess, target);
		return(result);
	}
}

