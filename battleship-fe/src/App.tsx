import React, { useState } from "react";

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

function App() {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [availableShips, setAvailableShips] = useState<Ship[]>(shipsData);
  const [selectedShipIndex, setSelectedShipIndex] = useState<number | null>(
    null
  );
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal"
  );
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

  // Set the selected ship index.
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

    // Copy the board and prepare a placement record.
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

    // Update board and history.
    setBoard(newBoard);
    setHistory((prevHistory) => [...prevHistory, placement]);

    // Remove the placed ship from the available ships.
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

    // Remove the last placement from history.
    const newHistory = [...history];
    const lastPlacement = newHistory.pop() as Placement;

    // Revert the board state (set the affected cells back to null).
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
    alert("All ships placed! Starting the game...");
    // Extend game logic here as needed.
  };

  return (
    <div className="App">
      <h1>Battleship Game</h1>
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
            {availableShips.map((ship, index) => (
              <button
                key={index}
                className={`ship-btn ${
                  selectedShipIndex === index ? "selected" : ""
                }`}
                onClick={() => selectShip(index)}
              >
                {ship.name} ({ship.length})
              </button>
            ))}
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
                  {cell ? cell.charAt(0) : ""}
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
