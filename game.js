// Firebase configuration
const firebaseConfig = {
    // TODO: Replace with your Firebase config object from the Firebase Console
    // Go to https://console.firebase.google.com/
    // 1. Create a new project or select existing one
    // 2. Click on the web icon (</>) to add a web app
    // 3. Register your app and copy the config object below
    apiKey: "AIzaSyAEy7UI3mXhETAso0pQZ1j0RryiEsqbdHA",
    authDomain: "tictactoe-c8769.firebaseapp.com",
    databaseURL: "https://tictactoe-c8769-default-rtdb.firebaseio.com",
    projectId: "tictactoe-c8769",
    storageBucket: "tictactoe-c8769.firebasestorage.app",
    messagingSenderId: "575016938636",
    appId: "1:575016938636:web:1445242faa247a9ce15fa9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Game state
let gameId = null;
let playerName = '';
let playerSymbol = '';
let isMyTurn = false;
let gameRef = null;
let isInMatchmaking = false;

// DOM Elements
const gameSetup = document.getElementById('game-setup');
const gameInfo = document.getElementById('game-info');
const gameBoard = document.getElementById('game-board');
const playerNameInput = document.getElementById('player-name');
const gameIdInput = document.getElementById('game-id');
const createGameBtn = document.getElementById('create-game');
const joinGameBtn = document.getElementById('join-game');
const findMatchBtn = document.getElementById('find-match');
const matchmakingStatus = document.getElementById('matchmaking-status');
const currentGameIdSpan = document.getElementById('current-game-id');
const playerSymbolSpan = document.getElementById('player-symbol');
const gameStatusSpan = document.getElementById('game-status');
const restartGameBtn = document.getElementById('restart-game');
const cells = document.querySelectorAll('.cell');
const onlineCountSpan = document.getElementById('online-count');
const restartVoteSection = document.getElementById('restart-vote-section');
const restartVoteStatus = document.getElementById('restart-vote-status');
const acceptRestartBtn = document.getElementById('accept-restart');
const rejectRestartBtn = document.getElementById('reject-restart');
const leaveGameBtn = document.getElementById('leave-game');

// New DOM Element for opponent name display
const opponentNameDisplaySpan = document.getElementById('opponent-name-display');

// Event Listeners
createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', joinGame);
restartGameBtn.addEventListener('click', requestRestart);
findMatchBtn.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
acceptRestartBtn.addEventListener('click', acceptRestart);
rejectRestartBtn.addEventListener('click', rejectRestart);
leaveGameBtn.addEventListener('click', leaveGame);

// Track online players
database.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
        const userStatusRef = database.ref(`/status/${generateUserId()}`);
        userStatusRef.set(true);
        userStatusRef.onDisconnect().remove();
    }
});

database.ref('/status').on('value', (snapshot) => {
    const count = Object.keys(snapshot.val() || {}).length;
    onlineCountSpan.textContent = count;
});

// Functions
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

function findMatch() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        Swal.fire({
            icon: 'warning',
            title: 'Name Required',
            text: 'Please enter your name before finding a match.',
            customClass: {
                popup: 'swal2-dark',
                title: 'swal2-title-dark',
                content: 'swal2-content-dark',
                confirmButton: 'swal2-confirm-dark'
            },
            background: '#1a1a1a',
            color: '#ffffff'
        });
        return;
    }

    isInMatchmaking = true;
    matchmakingStatus.textContent = '';
    findMatchBtn.disabled = true;

    // Show loading modal
    Swal.fire({
        title: 'Finding Opponent',
        text: 'Waiting for another player to join...',
        allowOutsideClick: false,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        cancelButtonColor: '#e74c3c',
        customClass: {
            popup: 'swal2-dark',
            title: 'swal2-title-dark',
            content: 'swal2-content-dark',
            cancelButton: 'swal2-cancel-dark'
        },
        background: '#1a1a1a',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    }).then((result) => {
        // Handle modal dismissal (Cancel button click)
        if (result.dismiss === Swal.DismissReason.cancel) {
            // Player cancelled matchmaking
            console.log('Matchmaking cancelled by user');
            const matchmakingRef = database.ref('matchmaking');
            // Find and remove the player's waiting entry
            matchmakingRef.orderByChild('playerName').equalTo(playerName).once('value', (snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    if (childSnapshot.val().status === 'waiting') {
                        childSnapshot.ref.remove();
                        console.log('Removed player from matchmaking', playerName);
                    }
                });
            });

            // Reset UI and state
            isInMatchmaking = false;
            matchmakingStatus.textContent = ''; // Clear status text
            findMatchBtn.disabled = false; // Ensure the button is re-enabled
        }
    });

    const matchmakingRef = database.ref('matchmaking');
    matchmakingRef.once('value', (snapshot) => {
        const matchmakingData = snapshot.val() || {};
        const waitingPlayers = Object.entries(matchmakingData)
            .filter(([_, data]) => data.status === 'waiting' && data.playerName !== playerName);

        if (waitingPlayers.length > 0) {
            // Join existing game
            const [waitingPlayerId, waitingPlayerData] = waitingPlayers[0];
            const newGameId = generateGameId();
            
            // Create new game
            const gameData = {
                players: {
                    X: waitingPlayerData.playerName,
                    O: playerName
                },
                currentTurn: 'X',
                board: Array(9).fill(''),
                gameOver: false,
                winner: null,
                winningLine: null
            };

            // Update matchmaking status for both players
            matchmakingRef.child(waitingPlayerId).update({
                status: 'matched',
                gameId: newGameId
            });

            // Remove the waiting player from matchmaking
            matchmakingRef.child(waitingPlayerId).remove();

            // Create the game
            database.ref(`games/${newGameId}`).set(gameData);
            
            // Join the game
            Swal.close(); // Close loading modal
            Swal.fire({
                icon: 'success',
                title: 'Player Found!',
                text: 'Starting game...',
                timer: 2500, // Show for 2.5 seconds
                timerProgressBar: true,
                showConfirmButton: false,
                 customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            }).then(() => {
                 joinMatchmakingGame(newGameId, 'O'); // Join the game after the modal closes
            });
        } else {
            // Create new matchmaking entry
            const playerId = generateUserId();
            matchmakingRef.child(playerId).set({
                playerName,
                status: 'waiting',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                playerId: playerId // Store playerId here
            });

            // Listen for opponent
            matchmakingRef.child(playerId).on('value', (snap) => {
                const data = snap.val();
                if (data && data.status === 'matched') {
                    const matchedGameId = data.gameId;
                    // Remove this player from matchmaking after being matched
                     matchmakingRef.child(playerId).remove();
                    
                    Swal.close(); // Close loading modal
                    Swal.fire({
                        icon: 'success',
                        title: 'Player Found!',
                        text: 'Starting game...',
                        timer: 2500, // Show for 2.5 seconds
                        timerProgressBar: true,
                        showConfirmButton: false,
                         allowOutsideClick: false,
                         customClass: {
                            popup: 'swal2-dark',
                            title: 'swal2-title-dark',
                            content: 'swal2-content-dark'
                        },
                        background: '#1a1a1a',
                        color: '#ffffff'
                    }).then(() => {
                         joinMatchmakingGame(matchedGameId, 'X'); // Join the game after the modal closes
                    });
                }
            });
        }
    });
}

function joinMatchmakingGame(gameId, symbol) {
    isInMatchmaking = false;
    matchmakingStatus.textContent = '';
    findMatchBtn.disabled = false;
    
    // Join the game
    gameRef = database.ref(`games/${gameId}`);
    gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
            Swal.fire({
                icon: 'error',
                title: 'Game Not Found',
                text: 'The game you tried to join was not found.',
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            });
            resetGameState();
            return;
        }

        playerSymbol = symbol;
        isMyTurn = symbol === 'X';
        gameId = gameId; // Set the global gameId

        // Update the game with the joining player's name if joining as O
        if (playerSymbol === 'O') {
             gameRef.update({
                 'players/O': playerName
             });
        }

        setupGame();
    });
}

function createGame() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        Swal.fire({
            icon: 'warning',
            title: 'Name Required',
            text: 'Please enter your name before creating a game.',
            customClass: {
                popup: 'swal2-dark',
                title: 'swal2-title-dark',
                content: 'swal2-content-dark',
                confirmButton: 'swal2-confirm-dark'
            },
            background: '#1a1a1a',
            color: '#ffffff'
        });
        return;
    }

    gameId = generateGameId();
    playerSymbol = 'X';
    isMyTurn = true;

    const gameData = {
        players: {
            X: playerName,
            O: null
        },
        currentTurn: 'X',
        board: Array(9).fill(''),
        gameOver: false,
        winner: null,
        winningLine: null
    };

    database.ref(`games/${gameId}`).set(gameData);
    setupGame();
}

function joinGame() {
    playerName = playerNameInput.value.trim();
    gameId = gameIdInput.value.trim();

    if (!playerName || !gameId) {
        Swal.fire({
            icon: 'warning',
            title: 'Information Required',
            text: 'Please enter your name and game ID to join.',
            customClass: {
                popup: 'swal2-dark',
                title: 'swal2-title-dark',
                content: 'swal2-content-dark',
                confirmButton: 'swal2-confirm-dark'
            },
            background: '#1a1a1a',
            color: '#ffffff'
        });
        return;
    }

    gameRef = database.ref(`games/${gameId}`);
    gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
            Swal.fire({
                icon: 'error',
                title: 'Game Not Found',
                text: `No game found with ID: ${gameId}`,
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            });
            return;
        }

        if (gameData.players.O) {
            Swal.fire({
                icon: 'info',
                title: 'Game Full',
                text: 'This game is already full.',
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            });
            return;
        }

        playerSymbol = 'O';
        isMyTurn = false;

        gameRef.update({
            'players/O': playerName
        });

        setupGame();
    });
}

function setupGame() {
    gameSetup.classList.add('hidden');
    gameInfo.classList.remove('hidden');
    gameBoard.classList.remove('hidden');
    restartGameBtn.classList.remove('hidden');
    leaveGameBtn.classList.remove('hidden');

    currentGameIdSpan.textContent = gameId;
    playerSymbolSpan.textContent = playerSymbol;
    updateGameStatus();

    if (!gameRef) {
        gameRef = database.ref(`games/${gameId}`);
    }

    // Remove any existing listeners
    gameRef.off();

    gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
             // Game was likely deleted (player left)
             Swal.fire({
                icon: 'info',
                title: 'Opponent Left',
                text: 'Your opponent has left the game.',
                allowOutsideClick: false,
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            }).then(() => {
                resetGameState();
            });
            return;
        }

        updateBoard(gameData.board, gameData);
        isMyTurn = gameData.currentTurn === playerSymbol;
        updateGameStatus(gameData);

        // Update opponent name display
        const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';
        const opponentName = gameData.players[opponentSymbol];
        opponentNameDisplaySpan.textContent = opponentName || 'Waiting...'; // Display waiting if opponent not joined yet

        if (gameData.winningLine) {
            // drawWinningLine(gameData.winningLine); // Removed call to drawWinningLine
        }

        // Handle restart voting
        if (gameData.restartVote) {
            handleRestartVote(gameData.restartVote);
        }
    });

    // Handle opponent disconnection by checking for child_removed in players
    gameRef.child('players').on('child_removed', (snapshot) => {
        const removedPlayerSymbol = snapshot.key;
        const removedPlayerName = snapshot.val(); // Get the name of the player who left

        if (removedPlayerSymbol === 'X' || removedPlayerSymbol === 'O') {
             Swal.fire({
                icon: 'info',
                title: 'Opponent Left',
                text: `${removedPlayerName || 'Your opponent'} has left the game.`, // Use name if available
                allowOutsideClick: false,
                 customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            }).then(() => {
                resetGameState();
            });
        }
    });
}

function handleCellClick(e) {
    if (!isMyTurn) return;

    const index = e.target.dataset.index;
    gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (gameData.board[index] || gameData.gameOver) return;

        const newBoard = [...gameData.board];
        newBoard[index] = playerSymbol;

        const updates = {
            board: newBoard,
            currentTurn: playerSymbol === 'X' ? 'O' : 'X'
        };

        const winner = checkWinner(newBoard);
        if (winner) {
            updates.gameOver = true;
            updates.winner = winner;
            updates.winningLine = getWinningLine(newBoard, winner);
        } else if (newBoard.every(cell => cell)) {
            updates.gameOver = true;
            updates.winner = 'draw';
        }

        gameRef.update(updates);
    });
}

function updateBoard(board, gameData) {
    cells.forEach((cell, index) => {
        const currentValue = cell.textContent;
        const newValue = board[index];
        
        if (currentValue !== newValue) {
            cell.textContent = ''; // Remove text content
            cell.className = `cell ${newValue.toLowerCase()}`;
        }
        // Ensure winning class is removed when board is updated (except for winning state)
        cell.classList.remove('winning'); // Remove winning class by default
    });

    // Add winning class to winning cells if a winning line exists in gameData
    if (gameData && gameData.winningLine) {
        const winningLine = gameData.winningLine;
        winningLine.forEach(index => {
            cells[index].classList.add('winning');
        });
    }
}

function updateGameStatus(gameData) {
    if (!gameData) {
        gameStatusSpan.textContent = 'Waiting for opponent';
        return;
    }

    if (gameData.gameOver) {
        if (gameData.winner === 'draw') {
            Swal.fire({
                title: 'Game Over!',
                text: 'The game ended in a draw!',
                icon: 'info',
                confirmButtonText: 'OK',
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            });
            gameStatusSpan.textContent = 'Game ended in a draw!';
        } else {
            const isWinner = gameData.winner === playerSymbol;
            Swal.fire({
                title: isWinner ? 'You Win!' : 'You Lose!',
                text: isWinner ? 'Congratulations!' : 'Better luck next time bitch!',
                icon: isWinner ? 'success' : 'error',
                confirmButtonText: 'OK',
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            });
            gameStatusSpan.innerHTML = `<span class="winner-animation">${gameData.players[gameData.winner]} wins!</span>`;
        }
    } else {
        // Display opponent's name if it's their turn
        const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';
        const opponentName = gameData.players[opponentSymbol];
        gameStatusSpan.textContent = isMyTurn ? 'Your turn' : `${opponentName}'s turn`; // Use opponent's name
    }
}

function restartGame() {
    if (!gameRef) return;

    gameRef.update({
        board: Array(9).fill(''),
        currentTurn: 'X',
        gameOver: false,
        winner: null,
        winningLine: null
    });

    // Remove winning line
    const winningLine = document.querySelector('.winning-line');
    if (winningLine) {
        winningLine.remove();
    }
}

function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return null;
}

function getWinningLine(board, winner) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] === winner && board[a] === board[b] && board[a] === board[c]) {
            return pattern;
        }
    }

    return null;
}

function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function requestRestart() {
    if (!gameRef) return;

    // Initiate restart vote in Firebase
    gameRef.update({
        restartVote: {
            [playerName]: true
        },
         // Remove winningLine property when requesting restart
         winningLine: null,
         gameOver: false
    });

    // Show SweetAlert2 loading modal while waiting for opponent's vote
    Swal.fire({
        title: 'Waiting for opponent...',
        text: 'Requesting game restart.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        customClass: {
            popup: 'swal2-dark',
            title: 'swal2-title-dark',
            content: 'swal2-content-dark',
            confirmButton: 'swal2-confirm-dark'
        },
        background: '#1a1a1a',
        color: '#ffffff'
    });

    // Hide the in-game restart button and vote section
    restartGameBtn.classList.add('hidden');
    restartVoteSection.classList.add('hidden'); // Ensure hidden
}

function handleRestartVote(restartVote) {
    const playerVotes = Object.keys(restartVote);

     // Close the loading modal if it's open
     Swal.close();

    if (restartVote.hasOwnProperty('rejected')) {
         // Vote was rejected
         Swal.fire({
             icon: 'error',
             title: 'Restart Rejected',
             text: 'Your opponent rejected the restart request.',
             customClass: {
                 popup: 'swal2-dark',
                 title: 'swal2-title-dark',
                 content: 'swal2-content-dark',
                 confirmButton: 'swal2-confirm-dark'
             },
             background: '#1a1a1a',
             color: '#ffffff'
         }).then(() => {
            // Reset vote state and hide restart vote section, show restart button
            gameRef.child('restartVote').remove();
            restartVoteSection.classList.add('hidden');
            restartGameBtn.classList.remove('hidden');
         });
         return;
    }

    if (playerVotes.length === 1 && playerVotes[0] !== playerName) {
        // Other player requested restart, show vote options using SweetAlert2
        Swal.fire({
            title: 'Restart Game?',
            text: `${playerVotes[0]} wants to restart the game. Do you agree?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, Restart!',
            cancelButtonText: 'No',
             customClass: {
                 popup: 'swal2-dark',
                 title: 'swal2-title-dark',
                 content: 'swal2-content-dark',
                 confirmButton: 'swal2-confirm-dark',
                 cancelButton: 'swal2-cancel-dark'
             },
             background: '#1a1a1a',
             color: '#ffffff'
        }).then((result) => {
            if (result.isConfirmed) {
                acceptRestart();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                rejectRestart();
            }
             // Hide the in-game vote section after interaction
             restartVoteSection.classList.add('hidden');
             restartGameBtn.classList.remove('hidden'); // Show restart button again
        });

    } else if (playerVotes.length === 2) {
        // Both players voted, restart the game

        // Determine who is the initiator (saw the loading modal) and who is the approver
        const initiatorIsCurrentPlayer = Swal.getPopup() && Swal.getTitle().textContent === 'Waiting for opponent...';

        if (initiatorIsCurrentPlayer) {
            // Show success modal to the player who initiated the restart
             Swal.fire({
                icon: 'success',
                title: 'Restart Approved!',
                text: 'Your opponent accepted. Restarting game...',
                timer: 2000, // Auto close after 2 seconds
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            });
        } else if (playerVotes.includes(playerName)) {
             // This player is the approver, show success modal
              Swal.fire({
                 icon: 'success',
                 title: 'Restart Accepted!',
                 text: 'You accepted the restart. Restarting game...',
                 timer: 2000, // Auto close after 2 seconds
                 timerProgressBar: true,
                 showConfirmButton: false,
                 customClass: {
                     popup: 'swal2-dark',
                     title: 'swal2-title-dark',
                     content: 'swal2-content-dark',
                     confirmButton: 'swal2-confirm-dark'
                 },
                 background: '#1a1a1a',
                 color: '#ffffff'
             });
        }

        // Get the current game state to determine the next turn
        gameRef.once('value', (snapshot) => {
            const gameData = snapshot.val();
            let nextTurn;

            if (gameData.winner && gameData.winner !== 'draw') {
                // If there was a winner, the loser starts the next round
                nextTurn = gameData.winner === 'X' ? 'O' : 'X';
            } else {
                // If it was a draw, alternate from the last turn
                nextTurn = gameData.currentTurn === 'X' ? 'O' : 'X';
            }

            // Reset the game state in Firebase with the new turn
            gameRef.update({
                board: Array(9).fill(''),
                currentTurn: nextTurn,
                gameOver: false,
                winner: null,
                winningLine: null,
                restartVote: null
            });

            // Reset the cells visually
            cells.forEach(cell => {
                cell.textContent = '';
                cell.className = 'cell no-select';
                cell.classList.remove('winning');
            });

            // Hide vote section and show restart button again
            restartVoteSection.classList.add('hidden');
            restartGameBtn.classList.remove('hidden');
        });
    } else if (playerVotes.length === 1 && playerVotes[0] === playerName) {
         // This player initiated the vote, SweetAlert loading modal is shown in requestRestart
        restartGameBtn.classList.add('hidden');
        restartVoteSection.classList.add('hidden'); // Ensure hidden
         acceptRestartBtn.classList.add('hidden');
         rejectRestartBtn.classList.add('hidden');
    }
}

function acceptRestart() {
    if (!gameRef) return;

    // Add this player's vote
    gameRef.child('restartVote').update({
        [playerName]: true
    });

    // SweetAlert handles interaction, no need to hide buttons here
}

function rejectRestart() {
     if (!gameRef) return;

    // Reject restart vote in Firebase
    gameRef.update({
        restartVote: { rejected: true } // Mark as rejected
    });

    // SweetAlert handles interaction, no need to hide buttons here
}

function leaveGame() {
    if (!gameRef) return;

    Swal.fire({
        title: 'Are you sure?',
        text: "You will leave the current game.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, leave game!',
        customClass: {
            popup: 'swal2-dark',
            title: 'swal2-title-dark',
            content: 'swal2-content-dark',
            confirmButton: 'swal2-confirm-dark',
            cancelButton: 'swal2-cancel-dark'
        },
        background: '#1a1a1a',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            // Remove player from game in Firebase
            gameRef.child('players').child(playerSymbol).remove();
            // If the game becomes empty, remove the game node as well
            gameRef.once('value', (snapshot) => {
                if (snapshot.exists() && !snapshot.val().players.X && !snapshot.val().players.O) {
                    gameRef.remove();
                }
            });
            
            // Show a confirmation modal to the player who left
            Swal.fire({
                icon: 'info',
                title: 'Game Left',
                text: 'You left the game.',
                timer: 2000, // Auto close after 2 seconds
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    popup: 'swal2-dark',
                    title: 'swal2-title-dark',
                    content: 'swal2-content-dark',
                    confirmButton: 'swal2-confirm-dark'
                },
                background: '#1a1a1a',
                color: '#ffffff'
            }).then(() => {
                 // Reset the game state after the modal closes
                 resetGameState();
            });
        }
    });
}

function resetGameState() {
    // Clear game state variables
    gameId = null;
    playerName = '';
    playerSymbol = '';
    isMyTurn = false;
    if (gameRef) {
        gameRef.off(); // Detach all listeners
        gameRef = null;
    }
    isInMatchmaking = false;

    // Reset UI
    gameSetup.classList.remove('hidden');
    gameInfo.classList.add('hidden');
    gameBoard.classList.add('hidden');
    restartGameBtn.classList.add('hidden');
    leaveGameBtn.classList.add('hidden');
    restartVoteSection.classList.add('hidden');
    matchmakingStatus.textContent = '';
    findMatchBtn.disabled = false;

    // Clear board visuals and remove winning class
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell no-select';
        cell.classList.remove('winning'); // Ensure winning class is removed
    });

    // Remove winning line element if it exists (shouldn't be needed with new logic, but as a safeguard)
    const winningLineElement = document.querySelector('.winning-line');
    if (winningLineElement) {
        winningLineElement.remove();
    }
} 