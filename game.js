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

// Event Listeners
createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', joinGame);
restartGameBtn.addEventListener('click', restartGame);
findMatchBtn.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

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
        alert('Please enter your name');
        return;
    }

    isInMatchmaking = true;
    matchmakingStatus.textContent = 'Finding opponent...';
    findMatchBtn.disabled = true;

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

            // Create the game
            database.ref(`games/${newGameId}`).set(gameData);
            
            // Join the game
            joinMatchmakingGame(newGameId, 'O');
        } else {
            // Create new matchmaking entry
            const playerId = generateUserId();
            matchmakingRef.child(playerId).set({
                playerName,
                status: 'waiting',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            // Listen for opponent
            matchmakingRef.child(playerId).on('value', (snap) => {
                const data = snap.val();
                if (data && data.status === 'matched') {
                    joinMatchmakingGame(data.gameId, 'X');
                }
            });
        }
    });
}

function joinMatchmakingGame(gameId, symbol) {
    isInMatchmaking = false;
    matchmakingStatus.textContent = 'Game found!';
    findMatchBtn.disabled = false;
    
    // Join the game
    gameRef = database.ref(`games/${gameId}`);
    gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) return;

        playerSymbol = symbol;
        isMyTurn = symbol === 'X';

        setupGame();
    });
}

function createGame() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your name');
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
        alert('Please enter your name and game ID');
        return;
    }

    gameRef = database.ref(`games/${gameId}`);
    gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
            alert('Game not found');
            return;
        }

        if (gameData.players.O) {
            alert('Game is full');
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
        if (!gameData) return;

        updateBoard(gameData.board);
        isMyTurn = gameData.currentTurn === playerSymbol;
        updateGameStatus(gameData);

        if (gameData.winningLine) {
            drawWinningLine(gameData.winningLine);
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

function updateBoard(board) {
    cells.forEach((cell, index) => {
        const currentValue = cell.textContent;
        const newValue = board[index];
        
        if (currentValue !== newValue) {
            cell.textContent = newValue;
            cell.className = `cell ${newValue.toLowerCase()}`;
        }
    });
}

function updateGameStatus(gameData) {
    if (!gameData) {
        gameStatusSpan.innerHTML = 'Waiting for opponent<span class="loading-dots"><span></span><span></span><span></span></span>';
        return;
    }

    if (gameData.gameOver) {
        if (gameData.winner === 'draw') {
            gameStatusSpan.textContent = 'Game ended in a draw!';
        } else {
            gameStatusSpan.innerHTML = `<span class="winner-animation">${gameData.players[gameData.winner]} wins!</span>`;
        }
    } else {
        gameStatusSpan.textContent = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
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

function drawWinningLine(winningLine) {
    // Remove existing winning line if any
    const existingLine = document.querySelector('.winning-line');
    if (existingLine) {
        existingLine.remove();
    }

    const board = document.querySelector('.board');
    const cells = board.querySelectorAll('.cell');
    const [first, second, third] = winningLine;

    // Calculate line position and dimensions
    const firstCell = cells[first].getBoundingClientRect();
    const secondCell = cells[second].getBoundingClientRect();
    const thirdCell = cells[third].getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    const line = document.createElement('div');
    line.className = 'winning-line';

    // Calculate center points of each cell
    const firstCenterX = firstCell.left + firstCell.width / 2;
    const firstCenterY = firstCell.top + firstCell.height / 2;
    const secondCenterX = secondCell.left + secondCell.width / 2;
    const secondCenterY = secondCell.top + secondCell.height / 2;
    const thirdCenterX = thirdCell.left + thirdCell.width / 2;
    const thirdCenterY = thirdCell.top + thirdCell.height / 2;

    // Determine if the line is horizontal, vertical, or diagonal
    if (Math.abs(firstCenterY - secondCenterY) < 5 && Math.abs(secondCenterY - thirdCenterY) < 5) {
        // Horizontal line
        const startX = Math.min(firstCenterX, secondCenterX, thirdCenterX);
        const endX = Math.max(firstCenterX, secondCenterX, thirdCenterX);
        line.style.width = `${endX - startX}px`;
        line.style.height = '6px';
        line.style.top = `${firstCenterY - boardRect.top - 3}px`;
        line.style.left = `${startX - boardRect.left}px`;
    } else if (Math.abs(firstCenterX - secondCenterX) < 5 && Math.abs(secondCenterX - thirdCenterX) < 5) {
        // Vertical line
        const startY = Math.min(firstCenterY, secondCenterY, thirdCenterY);
        const endY = Math.max(firstCenterY, secondCenterY, thirdCenterY);
        line.style.width = '6px';
        line.style.height = `${endY - startY}px`;
        line.style.left = `${firstCenterX - boardRect.left - 3}px`;
        line.style.top = `${startY - boardRect.top}px`;
    } else {
        // Diagonal line
        // Use the first and third cells of the winning line to determine start and end points
        const startCell = cells[first];
        const endCell = cells[third];

        const startCellRect = startCell.getBoundingClientRect();
        const endCellRect = endCell.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();

        // Calculate center points relative to the board
        const startX = (startCellRect.left + startCellRect.width / 2) - boardRect.left;
        const startY = (startCellRect.top + startCellRect.height / 2) - boardRect.top;
        const endX = (endCellRect.left + endCellRect.width / 2) - boardRect.left;
        const endY = (endCellRect.top + endCellRect.height / 2) - boardRect.top;

        const length = Math.sqrt(
            Math.pow(endX - startX, 2) +
            Math.pow(endY - startY, 2)
        );

        const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

        line.style.width = `${length}px`;
        line.style.height = '6px'; // Keep consistent thickness
        line.style.left = `${startX - 3}px`; // Position line based on start cell center, adjust by half thickness
        line.style.top = `${startY - 3}px`; // Position line based on start cell center, adjust by half thickness
        line.style.transform = `rotate(${angle}deg)`;
        line.style.transformOrigin = '0 0';
    }

    board.appendChild(line);
}

function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
} 