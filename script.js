// ==========================================================
// FIREBASE KONFIG — EZT CSERÉLD KI a saját Firebase projekted
// adataira! (Firebase Console → Project Settings → Your apps)
// ==========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBZr2IJFk4BhnA4YOvxUeIjDnzosn5D8t4",
    authDomain: "amoeba420-5e938.firebaseapp.com",
    databaseURL: "https://amoeba420-5e938-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "amoeba420-5e938",
    storageBucket: "amoeba420-5e938.firebasestorage.app",
    messagingSenderId: "1069298597368",
    appId: "1:1069298597368:web:7c05cc8d23544730172a0d",
    measurementId: "G-M7ZQXY8B8R"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================================
// Játék konstansok
// ==========================================================
const BOARD_SIZE = 15;
let cols = 40; // Oszlopok
let rows = 24; // Sorok
const WIN_LENGTH = 5;

// ==========================================================
// DOM elemek
// ==========================================================
const lobby = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const lobbyMessage = document.getElementById('lobbyMessage');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const statusDiv = document.getElementById('status');
const board = document.getElementById('board');
const restartBtn = document.getElementById('restartBtn');

let roomCode = null;
let mySymbol = null; // 'X' vagy 'O'
let roomRef = null;

// ==========================================================
// Szoba kód generálása (5 betűs random kód)
// ==========================================================
function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// ==========================================================
// Üres tábla létrehozása
// ==========================================================
function createEmptyBoard() {
    return new Array(cols * rows).fill("");
}

// ==========================================================
// Szoba létrehozása (Te leszel 'X')
// ==========================================================
createRoomBtn.addEventListener('click', () => {
    roomCode = generateRoomCode();
    mySymbol = 'X';
    roomRef = db.ref('rooms/' + roomCode);

    roomRef.set({
        board: createEmptyBoard(),
        currentPlayer: 'X',
        players: { X: true, O: false },
        status: 'waiting',
        winningCells: null
    }).then(() => {
        enterGame();
    });
});

// ==========================================================
// Csatlakozás meglévő szobához (Te leszel 'O')
// ==========================================================
joinRoomBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 5) {
        lobbyMessage.textContent = "Adj meg egy érvényes 5 karakteres kódot!";
        return;
    }

    const ref = db.ref('rooms/' + code);
    ref.get().then(snapshot => {
        if (!snapshot.exists()) {
            lobbyMessage.textContent = "Nincs ilyen szoba. Ellenőrizd a kódot!";
            return;
        }
        const data = snapshot.val();
        if (data.players.O) {
            lobbyMessage.textContent = "Ez a szoba már teljes!";
            return;
        }

        roomCode = code;
        mySymbol = 'O';
        roomRef = ref;

        roomRef.update({
            'players/O': true,
            status: 'playing'
        }).then(() => {
            enterGame();
        });
    });
});

// ==========================================================
// Belépés a játék képernyőre, és feliratkozás a változásokra
// ==========================================================
function enterGame() {
    lobby.style.display = 'none';
    gameScreen.style.display = 'block';
    roomCodeDisplay.textContent = roomCode;

    createBoardDOM();

    // Minden adatbázis-változásra frissítjük a UI-t
    roomRef.on('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;
        renderBoard(data.board, data.winningCells);
        updateStatus(data);
    });
}

// ==========================================================
// A tábla DOM elemeinek létrehozása (egyszer, induláskor)
// ==========================================================
function createBoardDOM() {
    board.innerHTML = "";
    // Itt mondjuk meg neki, hogy hány oszlop és sor legyen, szépen elosztva
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let i = 0; i < cols * rows; i++) {
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('cell');
        cellDiv.dataset.index = i;
        cellDiv.addEventListener('click', () => handleCellClick(i));
        board.appendChild(cellDiv);
    }
}

// ==========================================================
// A tábla kirajzolása az adatbázis állapota alapján
// ==========================================================
function renderBoard(boardState, winningCells) {
    boardState.forEach((val, i) => {
        const cellDiv = document.querySelector(`[data-index='${i}']`);
        cellDiv.textContent = val || "";
        cellDiv.classList.remove('X', 'O', 'winner');
        if (val) cellDiv.classList.add(val);
    });

    if (winningCells) {
        winningCells.forEach(i => {
            document.querySelector(`[data-index='${i}']`).classList.add('winner');
        });
    }
}

// ==========================================================
// Státusz szöveg frissítése
// ==========================================================
function updateStatus(data) {
    if (data.status === 'waiting') {
        statusDiv.textContent = "Várakozás a másik játékosra...";
    } else if (data.status === 'finished_win') {
        statusDiv.textContent = `🎉 A győztes: ${data.currentPlayer}!`;
    } else if (data.status === 'finished_draw') {
        statusDiv.textContent = "🤝 Döntetlen!";
    } else {
        const youOrOpponent = data.currentPlayer === mySymbol ? "Te jössz!" : "A másik játékos jön...";
        statusDiv.textContent = `${data.currentPlayer} lép — ${youOrOpponent}`;
    }
}

// ==========================================================
// Lépés kezelése — ELLENŐRZI, hogy rajtad van-e a sor,
// majd írja az adatbázisba (nem közvetlenül a DOM-ba!)
// ==========================================================
function handleCellClick(index) {
    roomRef.get().then(snapshot => {
        const data = snapshot.val();
        if (!data) return;
        if (data.status !== 'playing' && data.status !== undefined) {
            // ha még "waiting", de már mindketten csatlakoztak, engedjük a lépést is
        }
        if (data.board[index] !== "") return; // foglalt mező
        if (data.currentPlayer !== mySymbol) return; // nem te jössz
        if (data.status === 'finished_win' || data.status === 'finished_draw') return;

        const newBoard = [...data.board];
        newBoard[index] = mySymbol;

        const winningCells = checkWin(newBoard, index, mySymbol);
        let newStatus = 'playing';
        let nextPlayer = mySymbol === 'X' ? 'O' : 'X';

        if (winningCells) {
            newStatus = 'finished_win';
            nextPlayer = mySymbol; // a győztes neve marad kiírva
        } else if (!newBoard.includes("")) {
            newStatus = 'finished_draw';
        }

        roomRef.update({
            board: newBoard,
            currentPlayer: nextPlayer,
            status: newStatus,
            winningCells: winningCells || null
        });
    });
}

// ==========================================================
// Győzelem ellenőrzése (5 egymás melletti jel bármely irányban)
// ==========================================================
function checkWin(boardState, index, player) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const directions = [
        { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }
    ];

    function toIndex(r, c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return -1;
        return r * cols + c;
    }

    for (const { dr, dc } of directions) {
        let cells = [index];
        let r = row + dr, c = col + dc, i = toIndex(r, c);
        while (i !== -1 && boardState[i] === player) {
            cells.push(i); r += dr; c += dc; i = toIndex(r, c);
        }
        r = row - dr; c = col - dc; i = toIndex(r, c);
        while (i !== -1 && boardState[i] === player) {
            cells.push(i); r -= dr; c -= dc; i = toIndex(r, c);
        }
        if (cells.length >= WIN_LENGTH) return cells;
    }
    return null;
}
// ==========================================================
// Új játék gomb — visszaállítja a táblát ugyanabban a szobában
// ==========================================================
restartBtn.addEventListener('click', () => {
    roomRef.update({
        board: createEmptyBoard(),
        currentPlayer: 'X',
        status: 'playing',
        winningCells: null
    });
});
