import React from 'react';
import { api_getUsername, api_guess, api_newgame, api_getUserStats } from './api';

function ViewItem({ viewName, isActive, children }) {
  return isActive ? <section>{children}</section> : null;
}

// function handleKeyPress(keyValue) {
//   console.log(`Key pressed: ${keyValue}`);
// }

class Header extends React.Component {
  render() {
    const { activeView, setActiveView, playOrLobbyView } = this.props;

    // Updated function to determine active class for the span
    const navItemClass = (viewName) => {
      return activeView === viewName ? `ui_${viewName} active` : `ui_${viewName}`;
    };

    const navPlayClass = activeView === 'play' ? 'ui_play active' : 'ui_play';
    const navLobbyClass = activeView === 'lobby' ? 'ui_lobby active' : 'ui_lobby';


    return (
      <header>
        <nav className="ui_nav">
          <span className="alignleft"></span>
          <span className="aligncenter">
            <a href="#ui_home" onClick={(e) => { e.preventDefault(); setActiveView('home'); }}>
              <span className={`ui_home ${navItemClass('home')}`}>309DLE</span>
            </a>
          </span>
          <span className="alignright">
            <a href="#ui_username" onClick={(e) => { e.preventDefault(); setActiveView('username'); }}>
              <span className={navItemClass('username')}><i className="material-symbols-outlined">person</i></span>
            </a>
            <a href="#ui_play" onClick={(e) => { e.preventDefault(); setActiveView(playOrLobbyView); }}>
              <span className={playOrLobbyView === 'play' ? navPlayClass : navLobbyClass}>
                <i className="material-symbols-outlined">play_circle</i>
              </span>
            </a>
            <a href="#ui_stats" onClick={(e) => { e.preventDefault(); setActiveView('stats'); }}>
              <span className={`ui_stats ${navItemClass('stats')} material-symbols-outlined`}>leaderboard</span>
            </a>
            <a href="#ui_instructions" onClick={(e) => { e.preventDefault(); setActiveView('instructions'); }}>
              <span className={`ui_instructions ${navItemClass('instructions')} material-symbols-outlined`}>help</span>
            </a>
          </span>
        </nav>
      </header>
    );
  }
}

// Define Popup as its own class
class Popup extends React.Component {
  render() {
    const { isVisible, title, message, onClose } = this.props;

    if (!isVisible) {
      return null;
    }

    return (
      <div className="popup">
        <div className="popup-content">
          <div className="popup-header">
            <h2>{title}</h2>
          </div>
          <div className="popup-body">
            <p>{message}</p>
          </div>
          <div className="popup-footer">
            <button onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    );
  }
}

class SidePopup extends React.Component {
  componentDidMount() {
    setTimeout(() => {
      this.props.onFadeOut();
    }, 2000);
  }

  render() {
    const { message, topOffset } = this.props;
    // Apply the topOffset to position the popup
    const style = {
      top: `${topOffset}px`,
      position: 'absolute',
      right: '20px', // Adjust positioning as needed
    };

    return (
      <div className="error-popup" style={style}>
        {message}
      </div>
    );
  }
}

class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeView: 'username',
      username: '',
      currentGuess: '', // Tracks the letters entered for the current guess
      currentRow: 0, // Tracks the current attempt row (0-5)
      board: Array(6).fill(null).map(() => Array(5).fill('')), // Represents the guesses on the board
      gameStatus: 'idle', // 'idle', 'playing', 'won', 'lost'
      tileClasses: Array(6).fill(null).map(() => Array(5).fill('')),
      keyClasses: {},
      score: { wins: 0, losses: 0 },
      popupVisible: false,
      popupTitle: '',
      popupMessage: '',
      errorMessages: [],
      timeLeft: 0,
      isLobbyTime: true,
      playersList: [],
      firstWinner: null,
      firstWins: null,
      firstLosses: null,
      hasJoinedGame: false,
      shouldNavigateToPlay: false,
    };
    this.headerHeight = 90;
  }

  componentDidMount() {
    api_getUsername((data) => {
      if (data.username) {
        this.setState({ username: data.username }, this.updateStats);
      }
    });


    document.addEventListener('keydown', this.handleKeyPress);

    this.socket = new WebSocket(`ws://${window.location.hostname}:8212`);

    this.socket.onopen = () => {
      console.log("WebSocket connected for sending game outcomes.");
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "player-list-update") {
          // Set the new list of players
          this.setState({ playersList: data.players });
        } else if (data.type === "time-update") {
          this.updateTimeLeft(data.timeLeft);
        } else if (data.type === "first-winner") {
          this.setState({
            firstWinner: data.username,
            firstWins: data.firstWins,
            firstLosses: data.firstLosses
          });
        }
      } catch (error) {
        // If it's not JSON, it may be the comma-separated player names.
        const playerNames = [];
        let currentName = '';
        for (let i = 0; i < event.data.length; i++) {
          if (event.data[i] === ',') {
            playerNames.push(currentName.trim());
            currentName = '';
          } else {
            currentName += event.data[i];
          }
        }
        // Add the last player name if it's not empty
        if (currentName.trim().length > 0) {
          playerNames.push(currentName.trim());
        }

        this.setState({ playersList: playerNames });
      }
    };
  }

  updateTimeLeft = (timeLeftMillis) => {
    const totalTimeLeft = timeLeftMillis;
    const isLobbyTime = totalTimeLeft > (5 * 60 * 1000);
    const lobbyTimeLeft = isLobbyTime ? Math.min(totalTimeLeft - (5 * 60 * 1000), 30 * 1000) : 0;
    const timeLeftSeconds = Math.floor((isLobbyTime ? lobbyTimeLeft : totalTimeLeft) / 1000);

    console.log(`Total Time Left: ${totalTimeLeft}, Lobby Time Left: ${lobbyTimeLeft}`);

    this.setState({
      timeLeft: timeLeftSeconds,
      isLobbyTime: lobbyTimeLeft > 0,
    }, () => {
      console.log(`State Updated. Time Left: ${this.state.timeLeft}, Is Lobby Time: ${this.state.isLobbyTime}`);
      if (this.state.timeLeft <= 0 && !this.state.isLobbyTime) {
        console.log('Time left is 0 and not lobby time, returning to lobby.');
        this.returnToLobby();
        this.socket.send("Clear-Players");
      } else if (!this.state.isLobbyTime && this.state.hasJoinedGame && this.state.shouldNavigateToPlay) {
        this.setState({
          activeView: 'play',
          shouldNavigateToPlay: false, // Reset the flag to prevent unintended navigation in the future
        });
      }
    });
  };

  componentWillUnmount() {
    clearInterval(this.interval);
    if (this.socket) {
      this.socket.close();
    }

    document.removeEventListener('keydown', this.handleKeyPress);
  }

  updateStats = () => {
    if (this.state.username) {
      api_getUserStats(this.state.username, (data) => {
        if (data && !data.error) {
          this.setState({
            score: { wins: data.wins, losses: data.losses }
          });
        } else {
          console.log(data.error || "No stats available yet.");
        }
      });
    } else {
      console.log('Username not set. Waiting for username.');
      // Potentially set a flag to try updating stats again once a username is set
    }
  };

  setActiveView = (viewName) => {
    this.setState({ activeView: viewName });
  };

  handleKeyPress = (eventOrKeyValue) => {
    let keyValue;
    if (eventOrKeyValue instanceof KeyboardEvent) {
      // Check if the key is a letter, Backspace, or Enter
      if (/^[a-zA-Z]$/.test(eventOrKeyValue.key)) {
        keyValue = eventOrKeyValue.key.toUpperCase(); // Normalize to uppercase if it's a letter
      } else if (eventOrKeyValue.key === 'Backspace') {
        eventOrKeyValue.preventDefault(); // Prevent default Backspace behavior
        keyValue = 'DEL';
      } else if (eventOrKeyValue.key === 'Enter') {
        keyValue = 'ENTER';
      } else {
        return; // Early return for any other key
      }
    } else {
      // For input from the virtual keyboard, which should already be sanitized
      keyValue = eventOrKeyValue;
    }
    if (this.state.gameStatus !== 'playing') {
      console.log("The game is not in a playable state.");
      return;
    }

    console.log(`Key pressed: ${keyValue}`);
    if (keyValue === 'DEL') {
      this.setState(prevState => ({
        currentGuess: prevState.currentGuess.slice(0, -1)
      }));
    } else if (keyValue === 'ENTER') {
      const { currentGuess, currentRow, board, gameStatus } = this.state;

      if (currentGuess.length === 5 && gameStatus === 'playing') {
        // Send the guess to the server
        api_guess(this.state.username, currentGuess, (response) => {
          if (response.error) {
            // console.error('Error from server:', response.error);
            // this.showPopup('Error', response.error); // Use showPopup for errors
            this.showErrorPopup(response.error);
          } else {
            this.colourBoardAndKeyboard(response.score);

            const updatedBoard = board.map((row, rowIndex) => {
              if (rowIndex === currentRow) {
                return currentGuess.split('');
              }
              return row;
            });

            let newGameStatus = gameStatus;
            // Check if the game has been won or if all attempts are used
            if (response.state === 'won') {
              newGameStatus = 'won';

              this.socket.send(JSON.stringify({ action: "gameResult", username: this.state.username, result: "won" }));
              this.showPopup('Congratulations!', 'You guessed the correct word!');
            } else if (currentRow === 5) { // Use 5 here because it's the last attempt (0-indexed)
              newGameStatus = 'lost';
              this.showPopup('Game Over', `The correct word was: ${response.correctWord}`);
              this.socket.send(JSON.stringify({ action: "gameResult", username: this.state.username, result: "lost" }));
            }

            this.setState({
              board: updatedBoard,
              currentGuess: '',
              currentRow: currentRow + 1,
              gameStatus: newGameStatus
            }, () => {
              // If the game has finished, update stats
              if (newGameStatus === 'won' || newGameStatus === 'lost') {
                this.updateStats();
              }
            });
          }
        });
      } else {
        // this.showPopup('Incomplete guess.', 'Must be 5 letters.');
        this.showErrorPopup('Incomplete guess');
      }
    } else if (this.state.currentGuess.length < 5) {
      this.setState(prevState => ({
        currentGuess: prevState.currentGuess + keyValue
      }));
    }
  };



  colourBoardAndKeyboard = (score) => {
    this.setState(prevState => {
      // Copy the previous state to avoid mutations
      const newTileClasses = prevState.tileClasses.map(row => [...row]);
      const newKeyClasses = { ...prevState.keyClasses };

      score.forEach((item, index) => {
        const letter = prevState.currentGuess[index].toUpperCase();
        const classToAdd = item.score === 3 ? 'correct' : item.score === 2 ? 'present' : 'absent';

        // Update the tile classes
        newTileClasses[prevState.currentRow][index] = classToAdd;

        // Update the keyboard classes only if they are not already 'correct'
        if (!newKeyClasses[letter] || newKeyClasses[letter] !== 'correct') {
          newKeyClasses[letter] = classToAdd;
        }
      });

      // Return the updated state
      return {
        tileClasses: newTileClasses,
        keyClasses: newKeyClasses
      };
    });
  };

  handleNewGameClick = () => {
    api_newgame(this.state.username, (data) => {
      if (data.status === "created") {
        this.setState({
          hasJoinedGame: true,
          gameStatus: 'playing',
          currentRow: 0,
          currentGuess: '',
          board: Array(6).fill(null).map(() => Array(5).fill('')),
          keyClasses: {},
          tileClasses: Array(6).fill(null).map(() => Array(5).fill('')),
          shouldNavigateToPlay: true,
        }, this.updateStats); // Corrected to pass a function reference
      }
    });
    this.socket.send(this.state.username);
  };

  returnToLobby = () => {
    this.setState({
      activeView: 'lobby',
      gameStatus: 'idle',
      hasJoinedGame: false,
      // Reset other game states as necessary
      // ...
    });
  };

  showPopup = (title, message) => {
    this.setState({ popupVisible: true, popupTitle: title, popupMessage: message });
  };

  hidePopup = () => {
    this.setState({ popupVisible: false });
  };

  showErrorPopup = (message) => {
    this.setState(prevState => ({
      errorMessages: [...prevState.errorMessages, { id: Date.now(), message: message }],
    }));
  };

  handlePopupFadeOut = (id) => {
    this.setState(prevState => ({
      errorMessages: prevState.errorMessages.filter(msg => msg.id !== id),
    }));
  };

  renderTimeLeft() {
    const minutes = Math.floor(this.state.timeLeft / 60);
    const seconds = this.state.timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  render() {
    const { activeView, keyClasses, tileClasses, gameStatus } = this.state;
    const { popupVisible, popupTitle, popupMessage } = this.state;
    const { errorMessages } = this.state;
    const popupHeight = 50; // Approx height of each popup. Adjust as necessary
    const spacing = 10; // Space between each popup

    const playOrLobbyView = this.state.hasJoinedGame ? 'play' : 'lobby';

    return (
      <div>
        <Header
          activeView={this.state.activeView}
          setActiveView={this.setActiveView}
          playOrLobbyView={playOrLobbyView}
        />
        <ViewItem viewName="home" isActive={activeView === 'home'}>
          <div className="ui_top" id="ui_home" onClick={() => this.setActiveView('lobby')}>
            <div className="textblock">Classic<br />You have 6 chances to guess a word, the first one to guess it wins!.</div>
          </div>
        </ViewItem>
        <ViewItem viewName="username" isActive={activeView === 'username'}>
          <div className="ui_top" id="ui_username">
            <h2>username: <span id="username">{this.state.username}</span></h2>
          </div>
        </ViewItem>
        <ViewItem viewName="lobby" isActive={this.state.activeView === 'lobby'}>
          <center>
            <div className="lobby">
              <h2>Game Lobby</h2>
              {this.state.isLobbyTime ? (
                <>
                  <div className="timer-container">
                    <span className="time-left-label">Game starts in:</span>
                    <span className="timer-icon material-symbols-outlined">timer</span>
                    <span className="timer-time">{this.renderTimeLeft()}</span>
                  </div>
                  {!this.state.hasJoinedGame && (
                    <button id="play_newgame_button" className="new-game-button" onClick={this.handleNewGameClick}>Join Game</button>
                  )}
                  <div className="players-in-game">
                    <h3>PLAYERS IN LOBBY:</h3>
                    <ul className="players-list">
                      {this.state.playersList.map((player, index) => (
                        <li key={index} className={player === this.state.username ? 'current-player' : ''}>
                          {player}
                          {player === this.state.username ? ' - YOU' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {this.state.firstWinner ? (
                    <div className="stats-container">
                      <div className="stats-title">Latest Winner Stats</div>
                      <div className="winner-name">{this.state.firstWinner}</div>
                      <div className="stats-wins-losses">
                        <div className="stats-wins">Wins: {this.state.firstWins}</div>
                        <div className="stats-losses">Losses: {this.state.firstLosses}</div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div>
                    <div className="timer-container">
                      <span className="time-left-label">Time left until new game:</span>
                      <span className="timer-icon material-symbols-outlined">timer</span>
                      <span className="timer-time">{this.renderTimeLeft()}</span>
                    </div>
                    <div className="players-in-game">
                      <h3>PLAYERS IN GAME:</h3>
                      <ul className="players-list">
                        {this.state.playersList.map((player, index) => (
                          <li key={index} className={player === this.state.username ? 'current-player' : ''}>
                            {player}
                            {player === this.state.username ? ' - YOU' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {this.state.firstWinner ? (
                    <div className="stats-container">
                      <div className="stats-title">Latest Winner Stats</div>
                      <div className="winner-name">{this.state.firstWinner}</div>
                      <div className="stats-wins-losses">
                        <div className="stats-wins">Wins: {this.state.firstWins}</div>
                        <div className="stats-losses">Losses: {this.state.firstLosses}</div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </center>
        </ViewItem>
        <ViewItem viewName="play" isActive={activeView === 'play'}>
          <center>
            <div className="timer-container">
              <span className="timer-icon material-symbols-outlined">timer</span>
              <span className="timer-time">{this.renderTimeLeft()}</span>
            </div>
          </center>
          <div className="ui_top" id="ui_play">
            {/* Render the Wordle board */}
            <center>
              <table className="letterbox">
                <tbody>
                  {this.state.board.map((row, rowIndex) => (
                    <tr key={rowIndex} className={`row${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className={tileClasses[rowIndex][cellIndex]}>
                          {rowIndex === this.state.currentRow && this.state.currentGuess[cellIndex]
                            ? this.state.currentGuess[cellIndex] // Display current guess letter
                            : cell} {/* Display board letter */}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </center>
            <br /><br />
            <center>
              {/* First row of letters */}
              <table className="keyboardrow">
                <tbody>
                  <tr>
                    {'QWERTYUIOP'.split('').map((key) => (
                      <td key={key} className={keyClasses[key]} onClick={() => this.handleKeyPress(key)}>{key}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              {/* Second row of letters */}
              <table className="keyboardrow">
                <tbody>
                  <tr>
                    {'ASDFGHJKL'.split('').map((key) => (
                      <td key={key} className={keyClasses[key]} onClick={() => this.handleKeyPress(key)}>{key}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              {/* Third row of letters including DEL and ENTER */}
              <table className="keyboardrow">
                <tbody>
                  <tr>
                    <td onClick={() => this.handleKeyPress('DEL')}>DEL</td>
                    {'ZXCVBNM'.split('').map((key) => (
                      <td key={key} className={keyClasses[key]} onClick={() => this.handleKeyPress(key)}>{key}</td>
                    ))}
                    <td onClick={() => this.handleKeyPress('ENTER')}>ENTER</td>
                  </tr>
                </tbody>
              </table>
            </center>
            <br /><br />
            <center>
              {gameStatus !== 'playing' && (
                <button id="play_newgame_button" className="new-game-button" onClick={this.returnToLobby}>
                  RETURN TO LOBBY
                </button>
              )}
            </center>
          </div>
        </ViewItem>
        <ViewItem viewName="stats" isActive={activeView === 'stats'}>
          <div className="ui_top" id="ui_stats">
            <center style={{ fontSize: 'xx-large' }}>
              <span className="material-symbols-outlined">check_circle</span> {this.state.score.wins} &nbsp;
              <span className="material-symbols-outlined">help</span> 0 &nbsp;
              <span className="material-symbols-outlined">cancel</span> {this.state.score.losses}
            </center>
          </div>
        </ViewItem>
        <ViewItem viewName="instructions" isActive={activeView === 'instructions'}>
          <div className="ui_top" id="ui_instructions">
            <h1>How to Play</h1>

            <div className="game-mode">
              <h2>Classic game mode</h2>
              <p>Join a classic lobby to play against 100 players and guess the word in six tries.</p>
              <p>Only valid five-letter words can be submitted.</p>
              <p>After each guess, the color of the letters will change to indicate how good your guess was!</p>
            </div>

            <hr />

            <div className="letter-examples">
              <h2>Letter indication examples</h2>

              <p>The letter E is in the correct position.</p>
              <table className="example-table">
                <tbody>
                  <tr className="example-row">
                    <td>H</td>
                    <td className="correct-position">E</td>
                    <td>L</td>
                    <td>L</td>
                    <td>O</td>
                  </tr>
                </tbody>
              </table>

              <p>The letter A is in an incorrect position but present in the word.</p>
              <table className="example-table">
                <tbody>
                  <tr className="example-row">
                    <td className="incorrect-position">A</td>
                    <td>B</td>
                    <td>O</td>
                    <td>U</td>
                    <td>T</td>
                  </tr>
                </tbody>
              </table>

              <p>The letters C and E are not in the word.</p>
              <table className="example-table">
                <tbody>
                  <tr className="example-row">
                    <td>S</td>
                    <td>A</td>
                    <td>U</td>
                    <td className="absent">C</td>
                    <td className="absent">E</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ViewItem>
        <div>
          <Popup
            isVisible={popupVisible}
            title={popupTitle}
            message={popupMessage}
            onClose={this.hidePopup}
          />
        </div>
        {errorMessages.map((msg, index) => (
          <SidePopup
            key={msg.id}
            message={msg.message}
            topOffset={this.headerHeight + (index * (popupHeight + spacing)) + spacing}
            onFadeOut={() => this.handlePopupFadeOut(msg.id)}
          />
        ))}
      </div>
    );
  }
}
export { Main };