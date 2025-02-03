const path = require("path");
const chai = require("chai");
const { wasm } = require("circom_tester");
const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;
const assert = chai.assert;
const wasm_tester = require("circom_tester").wasm;

// the prime used by circom
const p = Scalar.fromString(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);
const Fr = new F1Field(p);

describe("BattleshipInit Circuit Test", function () {
  this.timeout(100000);

  /*
    The circuit BattleshipInit(10) takes five ships as input, each defined by
    an array of [x,y] coordinates. The ships are:

      - Carrier of size 5
      - Battleship of size 4
      - Cruiser of size 3
      - Submarine of size 3
      - Destroyer of size 2

    Each ship is constrained such that:
      · every coordinate must be within the board bounds [0, 10).
      · the ship's alignment is either horizontal or vertical with
        consecutive points (difference of 1 in either x or y).
    In the circuit, additional Pedersen hashing is performed on a grid
    representing whether a ship occupies each cell (ensuring no overlapping)
    and a salt.

    In this test, we choose ships that lie in different rows so they do not
    overlap.
  */

  it("should generate a valid witness for a correct ship placement", async () => {
    // load the circuit (adjust the relative path to where your circuit is)
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "battleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // Valid placement:
    // Place Carrier (size 5) horizontally along row 0, columns 0 to 4.
    const carrier = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ];

    // Battleship (size 4) at row 1, columns 0 to 3
    const battleship = [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ];

    // Cruiser (size 3) at row 2, columns 0 to 2
    const cruiser = [
      [0, 2],
      [1, 2],
      [2, 2],
    ];

    // Submarine (size 3) at row 3, columns 0 to 2
    const submarine = [
      [0, 3],
      [1, 3],
    ];

    // Destroyer (size 2) at row 4, columns 0 to 1
    const destroyer = [
      [0, 4],
      [1, 4],
    ];

    // Create and print grid visualization
    const grid = Array(10).fill().map(() => Array(10).fill('.'));
    
    // Place ships on grid with their sizes
    carrier.forEach(([x, y]) => grid[y][x] = '5');     // Carrier - size 5
    battleship.forEach(([x, y]) => grid[y][x] = '4');  // Battleship - size 4
    cruiser.forEach(([x, y]) => grid[y][x] = '3');     // Cruiser - size 3
    submarine.forEach(([x, y]) => grid[y][x] = '2');   // Submarine - size 2
    destroyer.forEach(([x, y]) => grid[y][x] = '1');   // Destroyer - size 1

    // Print grid
    console.log('\nBattleship Grid:');
    console.log('   0 1 2 3 4 5 6 7 8 9');
    grid.forEach((row, i) => {
      console.log(`${i < 10 ? ' ' : ''}${i} ${row.join(' ')}`);
    });
    console.log('\nLegend: 5=Carrier, 4=Battleship, 3=Cruiser, 2=Submarine, 1=Destroyer\n');

    // a salt value for the Pedersen hash input,
    // could be any field element (we choose 12345 as an example)
    const salt = 12345;

    // Prepare the input for the circuit.
    const circuitInputs = {
      carrier,
      battleship,
      cruiser,
      submarine,
      destroyer,
      salt,
    };

    // Calculate the witness.
    const witness = await circuit.calculateWitness(circuitInputs, true);

    const solidityCall = await circuit.ge(circuitInputs, true);
    console.log("Solidity Call: ", solidityCall);

    // Optionally, you can check the public output.
    //
    // In our circuit, 'out' is the Pedersen hash result (an array of 2 numbers).
    // You may check that the first element of the witness is always 1.
    //
    // witness[0] corresponds to the constant 1.
    assert.equal(witness[0].toString(), "1");

    // If you have an expected Pedersen hash value for this input board,
    // you could compare the output. Otherwise, simply print the output.
    const pedersenOut = witness.slice(1, 3).map((x) => x.toString());
    console.log("Pedersen Hash Output: ", pedersenOut);
  });

  it("should fail if a ship coordinate is outside the board", async () => {
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "battleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // We introduce an error by placing one coordinate out of the board.
    // Carrier placed with one point at (10, 0) which is not allowed
    const carrier = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [10, 0], // invalid coordinate: 10 is not < boardLength (10)
    ];

    // Other ships are valid.
    const battleship = [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ];
    const cruiser = [
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    const submarine = [
      [0, 3],
      [1, 3],
    ];
    const destroyer = [
      [0, 4],
      [1, 4],
    ];

    const salt = 12345;

    const circuitInputs = {
      carrier,
      battleship,
      cruiser,
      submarine,
      destroyer,
      salt,
    };

    let failed = false;
    try {
      await circuit.calculateWitness(circuitInputs, true);
    } catch (err) {
      failed = true;
      console.log("Error (expected): ", err.message);
    }
    assert.isTrue(
      failed,
      "The witness computation should have failed due to an invalid coordinate"
    );
  });

  it("should fail if ship points are not aligned consecutively", async () => {
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "battleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // Here, we mess up the alignment constraint for one ship.
    // Carrier points should be consecutive; we introduce
    // a gap in the positions.
    const carrier = [
      [0, 0],
      [1, 0],
      [3, 0], // gap: from 1 to 3, missing 2
      [4, 0],
      [5, 0],
    ];
    const battleship = [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ];
    const cruiser = [
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    const submarine = [
      [0, 3],
      [1, 3],
    ];
    const destroyer = [
      [0, 4],
      [1, 4],
    ];

    const salt = 12345;

    const circuitInputs = {
      carrier,
      battleship,
      cruiser,
      submarine,
      destroyer,
      salt,
    };

    let failed = false;
    try {
      const witness = await circuit.calculateWitness(circuitInputs, true);
      console.log(witness);
    } catch (err) {
      failed = true;
      console.log("Alignment Error (expected): ", err.message);
    }
    assert.isTrue(
      failed,
      "Witness computation should have failed due to ship misalignment"
    );
  });
});


