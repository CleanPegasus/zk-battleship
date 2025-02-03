import React, { useState } from "react";

// Import ship assets (SVGs)
import carrierImg from "./assets/carrier.svg";
import battleshipImg from "./assets/battleship.svg";
import cruiserImg from "./assets/cruiser.svg";
import submarineImg from "./assets/submarine.svg";
import destroyerImg from "./assets/destroyer.svg";

// Decorative floating ship (SVG)
import floatingShipImg from "./assets/ship-floating.svg";

const gridSize = 10;

// Types
type Cell = string | null;
type Board = Cell[][];

interface Ship {
  name: string;
  length: number;
}

interface Placement {
  ship: Ship;
  row: number;
  col: number;
  orientation: "horizontal" | "vertical";
  // List of cell coordinates that were affected during placement.
  cells: Array<{ row: number; col: number }>;
}

// Create an initial 10x10 board.
const createInitialBoard = (): Board =>
  Array.from({ length: gridSize }, () => Array(gridSize).fill(null));

// Define your ships.
const shipsData: Ship[] = [
  { name: "Carrier", length: 5 },
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Submarine", length: 3 },
  { name: "Destroyer", length: 2 },
];

// Map ship names to images.
const shipImages: { [key: string]: string } = {
  Carrier: carrierImg,
  Battleship: battleshipImg,
  Cruiser: cruiserImg,
  Submarine: submarineImg,
  Destroyer: destroyerImg,
};

interface GameState {
  board: Board;
  opponentBoard: Board;
  playerAttacks: ("hit" | "miss" | null)[][];
  opponentAttacks: ("hit" | "miss" | null)[][];
}

function App() {
  const [gameState, setGameState] = useState<"placement" | "battle">("placement");
  const [gameBoards, setGameBoards] = useState<GameState>({
    board: createInitialBoard(),
    opponentBoard: createInitialBoard(),
    playerAttacks: Array.from({ length: gridSize }, () => Array(gridSize).fill(null)),
    opponentAttacks: Array.from({ length: gridSize }, () => Array(gridSize).fill(null))
  });
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [availableShips, setAvailableShips] = useState<Ship[]>(shipsData);
  const [selectedShipIndex, setSelectedShipIndex] = useState<number | null>(
    null
  );
  const [orientation, setOrientation] =
    useState<"horizontal" | "vertical">("horizontal");
  const [joinCode, setJoinCode] = useState<string>("");
  const [message, setMessage] = useState<string>(
    "Select a ship and click on the grid to place it."
  );
  // History of placements to support undo.
  const [history, setHistory] = useState<Placement[]>([]);

  // Placeholder join game handler.
  const handleJoinGame = () => {
    alert("Join game feature is not implemented in this demo.");
  };

  const handleToggleOrientation = () => {
    setOrientation((prev) =>
      prev === "horizontal" ? "vertical" : "horizontal"
    );
  };

  // Choose a ship from the inventory.
  const selectShip = (index: number) => setSelectedShipIndex(index);

  // Handle cell click for ship placement.
  const handleCellClick = (row: number, col: number) => {
    if (selectedShipIndex === null) {
      setMessage("Please select a ship first.");
      return;
    }
    const ship = availableShips[selectedShipIndex];
    if (!ship) return;

    if (!isValidPlacement(row, col, ship, orientation, board)) {
      alert("Invalid placement. Try a different position or orientation.");
      return;
    }

    // Copy board and record placement.
    const newBoard: Board = board.map((row) => row.slice());
    const placement: Placement = { ship, row, col, orientation, cells: [] };

    if (orientation === "horizontal") {
      for (let i = 0; i < ship.length; i++) {
        newBoard[row][col + i] = ship.name;
        placement.cells.push({ row, col: col + i });
      }
    } else {
      for (let i = 0; i < ship.length; i++) {
        newBoard[row + i][col] = ship.name;
        placement.cells.push({ row: row + i, col });
      }
    }

    setBoard(newBoard);
    setHistory((prevHistory) => [...prevHistory, placement]);

    // Remove the placed ship from available ships.
    const newAvailableShips = availableShips.filter(
      (_s, i) => i !== selectedShipIndex
    );
    setAvailableShips(newAvailableShips);
    setSelectedShipIndex(null);
    setMessage("Select a ship and click on the grid to place it.");
  };

  // Handler for undoing the last ship placement.
  const handleUndo = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const lastPlacement = newHistory.pop() as Placement;

    // Revert the affected board cells.
    const newBoard: Board = board.map((row) => row.slice());
    lastPlacement.cells.forEach(({ row, col }) => {
      newBoard[row][col] = null;
    });
    setBoard(newBoard);
    // Add the undone ship back to available ships.
    setAvailableShips((prevShips) => [...prevShips, lastPlacement.ship]);
    setHistory(newHistory);
  };

  // Start game when all ships have been placed.
  const handleStartGame = () => {
    setGameState("battle");
    setMessage("Click on the opponent's board to attack!");
  };

  const handleOpponentGridClick = (row: number, col: number) => {
    if (gameState !== "battle" || gameBoards.playerAttacks[row][col]) return;
    // Placeholder attack logic
    const newGameBoards = { ...gameBoards };
    newGameBoards.playerAttacks[row][col] = Math.random() < 0.5 ? "hit" : "miss";
    setGameBoards(newGameBoards);
  };

  return (
    <div className="arcade-container">
      {/* Background animated ships */}
      <div className="animated-ships">
        <div className="animated-ship" style={{ left: "10%" }} />
        <div className="animated-ship" style={{ left: "40%" }} />
        <div className="animated-ship" style={{ left: "70%" }} />
      </div>

      <div className="App">
        <h1>Battleship Arcade</h1>

        {gameState === "placement" ? (
          <>
            <div className="join-game">
              <h2>Join Game</h2>
              <input
                type="text"
                placeholder="Enter Game Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button onClick={handleJoinGame}>Join Game</button>
            </div>

            <div className="game-container">
              {/* Ship Placement Panel */}
              <div className="ship-placement">
                <h2>Place Your Ships</h2>
                <div className="orientation-toggle">
                  Orientation:
                  <button onClick={handleToggleOrientation}>
                    {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
                  </button>
                </div>
                <div className="ships-list">
                  <h3>Available Ships</h3>
                  <div className="ships-inventory">
                    {availableShips.map((ship, index) => (
                      <div
                        key={index}
                        className={`ship-item ${selectedShipIndex === index ? "selected" : ""}`}
                        onClick={() => selectShip(index)}
                      >
                        <img src={shipImages[ship.name]} alt={ship.name} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="instructions">{message}</div>
              </div>

              {/* Grid Board */}
              <div className="grid-section">
                <h2>Your Board</h2>
                <div className="grid">
                  {board.map((rowData, row) =>
                    rowData.map((cell, col) => (
                      <div
                        key={`${row}-${col}`}
                        className="cell"
                        onClick={() => handleCellClick(row, col)}
                      >
                        {cell ? <img src={shipImages[cell]} alt={cell} className="cell-ship-image" /> : ""}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="buttons-row">
              <button
                onClick={handleStartGame}
                disabled={availableShips.length !== 0}
                className="start-game"
              >
                Start Game
              </button>
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="undo-button"
              >
                Undo Last Placement
              </button>
            </div>
          </>
        ) : (
          <div className="game-container">
            {/* Player's Board */}
            <div className="grid-section">
              <h2>Your Board</h2>
              <div className="grid">
                {board.map((rowData, row) =>
                  rowData.map((cell, col) => (
                    <div key={`${row}-${col}`} className="cell">
                      {cell ? <img src={shipImages[cell]} alt={cell} className="cell-ship-image" /> : ""}
                      {gameBoards.opponentAttacks[row][col] && (
                        <div className={`attack ${gameBoards.opponentAttacks[row][col]}`} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Opponent's Board */}
            <div className="grid-section">
              <h2>Opponent's Board</h2>
              <div className="grid">
                {gameBoards.opponentBoard.map((rowData, row) =>
                  rowData.map((cell, col) => (
                    <div
                      key={`${row}-${col}`}
                      className="cell"
                      onClick={() => handleOpponentGridClick(row, col)}
                    >
                      {gameBoards.playerAttacks[row][col] && (
                        <div className={`attack ${gameBoards.playerAttacks[row][col]}`} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: Validate ship placement.
function isValidPlacement(
  row: number,
  col: number,
  ship: Ship,
  orientation: "horizontal" | "vertical",
  board: Board
): boolean {
  if (orientation === "horizontal") {
    if (col + ship.length > gridSize) return false;
    for (let i = 0; i < ship.length; i++) {
      if (board[row][col + i] !== null) return false;
    }
  } else {
    if (row + ship.length > gridSize) return false;
    for (let i = 0; i < ship.length; i++) {
      if (board[row + i][col] !== null) return false;
    }
  }
  return true;
}

export default App;
