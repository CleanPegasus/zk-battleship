# Zero-Knowledge Battleship Circuits

This directory contains the zero-knowledge circuits used in the Battleship game implementation. These circuits ensure that players can prove the validity of their moves without revealing their entire board state.

## Circuit Components

### 1. BattleshipInit Circuit
- **Purpose**: Validates the initial placement of ships on the board and generates a commitment.
- **Input**:
  - `carrier[5][2]`: Coordinates for the Carrier (size 5)
  - `battleship[4][2]`: Coordinates for the Battleship (size 4)
  - `cruiser[3][2]`: Coordinates for the Cruiser (size 3)
  - `submarine[2][2]`: Coordinates for the Submarine (size 2)
  - `destroyer[2][2]`: Coordinates for the Destroyer (size 2)
  - `salt`: Random value for commitment
- **Output**: Pedersen hash commitment of the board state

### 2. VerifyBattleshipPosition Circuit
- **Purpose**: Verifies if a specific position contains a ship and proves it without revealing the entire board
- **Input**:
  - `grid[10][10]`: The game board state
  - `salt`: The salt used in the commitment
  - `p[2]`: The position to verify (x,y coordinates)
- **Output**: 
  - `out`: Whether the position contains a ship (1) or not (0)
  - `gridHash`: Hash of the entire grid for verification

## Helper Templates

### QuinSelector
- Implements efficient position selection in the grid
- Used by VerifyBattleshipPosition for coordinate lookup

## Usage

1. **Compile Circuits**:
```bash
./scripts/run_circuit.sh battleship    # For BattleshipInit
./scripts/run_circuit.sh verifybattleship    # For VerifyBattleshipPosition