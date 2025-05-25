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

// DOM Elements
const gameSetup = document.getElementById('game-setup');
const gameInfo = document.getElementById('game-info');
const gameBoard = document.getElementById('game-board');
const playerNameInput = document.getElementById('player-name');
const gameIdInput = document.getElementById('game-id');
const createGameBtn = document.getElementById('create-game');
const joinGameBtn = document.getElementById('join-game');
const currentGameIdSpan = document.getElementById('current-game-id');
const playerSymbolSpan = document.getElementById('player-symbol');
const gameStatusSpan = document.getElementById('game-status');
const restartGameBtn = document.getElementById('restart-game');
const cells = document.querySelectorAll('.cell');

// Event Listeners
createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', joinGame);
restartGameBtn.addEventListener('click', restartGame);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

// Functions
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
        winner: null
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

    gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) return;

        updateBoard(gameData.board);
        isMyTurn = gameData.currentTurn === playerSymbol;
        updateGameStatus(gameData);
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
        winner: null
    });
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

function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
} 