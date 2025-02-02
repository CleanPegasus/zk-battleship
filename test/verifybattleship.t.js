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

describe("VerifyBattleshipPosition Circuit Test", function () {
  this.timeout(100000);

  it("should verify a valid position with a ship", async () => {
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "verifybattleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // Create a 10x10 grid with a ship at position (0,0)
    const grid = Array(10).fill().map(() => Array(10).fill(0));
    grid[0][0] = 1;

    const salt = 12345;
    const p = [0, 0]; // Select position (0,0)

    const circuitInputs = {
      grid,
      salt,
      p,
    };

    const witness = await circuit.calculateWitness(circuitInputs, true);

    // Verify that the output is 1 (ship present)
    assert.equal(witness[1].toString(), "1");

    // Verify the grid hash
    const gridHash = witness.slice(2, 4).map((x) => x.toString());
    console.log("Grid Hash:", gridHash);
  });

  it("should verify an invalid position without a ship", async () => {
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "verifybattleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // Create a 10x10 grid with no ships
    const grid = Array(10).fill().map(() => Array(10).fill(0));

    const salt = 12345;
    const p = [0, 0]; // Select position (0,0)

    const circuitInputs = {
      grid,
      salt,
      p,
    };

    const witness = await circuit.calculateWitness(circuitInputs, true);

    // Verify that the output is 0 (no ship present)
    assert.equal(witness[1].toString(), "0");

    // Verify the grid hash
    const gridHash = witness.slice(1, 3).map((x) => x.toString());
    console.log("Grid Hash:", gridHash);
  });

  it("should handle edge cases at the boundaries of the grid", async () => {
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "verifybattleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // Create a 10x10 grid with a ship at the top-left corner (0,0)
    // and another at the bottom-right corner (9,9)
    const grid = Array(10).fill().map(() => Array(10).fill(0));
    grid[0][0] = 1;
    grid[9][9] = 1;

    const salt = 12345;

    // Test top-left corner (0,0)
    let p = [0, 0];
    let circuitInputs = {
      grid,
      salt,
      p,
    };
    let witness = await circuit.calculateWitness(circuitInputs, true);
    assert.equal(witness[1].toString(), "1");

    // Test bottom-right corner (9,9)
    p = [9, 9];
    circuitInputs = {
      grid,
      salt,
      p,
    };
    witness = await circuit.calculateWitness(circuitInputs, true);
    assert.equal(witness[1].toString(), "1");

    // Verify the grid hash
    const gridHash = witness.slice(1, 3).map((x) => x.toString());
    console.log("Grid Hash:", gridHash);
  });

  it("should fail when the position does not match the grid", async () => {
    const circuitPath = path.join(
      __dirname,
      "../circuits",
      "verifybattleship.circom"
    );
    const circuit = await wasm_tester(circuitPath);
    await circuit.loadConstraints();

    // Create a 10x10 grid with a ship at position (0,0)
    const grid = Array(10).fill().map(() => Array(10).fill(0));
    grid[0][0] = 1;

    const salt = 12345;
    const p = [1, 1]; // Select position (1,1) which should be empty

    const circuitInputs = {
      grid,
      salt,
      p,
    };

    const witness = await circuit.calculateWitness(circuitInputs, true);

    // Verify that the output is 0 (no ship present)
    assert.equal(witness[1].toString(), "0");

    // Verify the grid hash
    const gridHash = witness.slice(1, 3).map((x) => x.toString());
    console.log("Grid Hash:", gridHash);
  });
});
