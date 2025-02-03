const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const snarkjs = require("snarkjs");

// Helper function: Mine a given number of blocks to simulate deadline timeouts.
async function mineBlocks(num) {
  for (let i = 0; i < num; i++) {
    await hre.network.provider.send("evm_mine");
  }
}

async function generateBattleshipProof(circuitInputs) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs, 
    "build/battleship_js/battleship.wasm", 
    "build/battleship_keys/battleship_0001.zkey");

    return [proof, publicSignals]
}

async function commitBattleshipGrid() {
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

  const salt = 12345;

  const circuitInputs = {
    carrier,
    battleship,
    cruiser,
    submarine,
    destroyer,
    salt,
  };

  const [proof, publicSignals] = await generateBattleshipProof(circuitInputs);
  return [proof, publicSignals]
}

describe("Battleship Contract", function () {
  let battleship;
  let battleshipVerifier;
  let gridPosVerifier;
  let player1, player2, others;

  beforeEach(async function () {
    // Get signers
    [player1, player2, ...others] = await hre.ethers.getSigners();

    // Deploy dummy verifiers (they always return true)
    const BattleshipGroth16Verifier = await hre.ethers.getContractFactory("BattleshipGroth16Verifier");
    battleshipVerifier = await BattleshipGroth16Verifier.deploy();
    await battleshipVerifier.waitForDeployment();

    const GridPosGroth16Verifier = await hre.ethers.getContractFactory("GridPosGroth16Verifier");
    gridPosVerifier = await GridPosGroth16Verifier.deploy();
    await gridPosVerifier.waitForDeployment();

    console.log("BattleshipGroth16Verifier deployed to:", await battleshipVerifier.getAddress());
    console.log("GridPosGroth16Verifier deployed to:", await gridPosVerifier.getAddress());

    // Deploy the Battleship contract with the dummy verifier addresses
    const Battleship = await hre.ethers.getContractFactory("Battleship");
    battleship = await Battleship.deploy(
        await battleshipVerifier.getAddress(),
        await gridPosVerifier.getAddress()
    );
    await battleship.waitForDeployment();
  });

  describe("Player joining and grid commit", function () {
    it("should allow two players to join and commit a grid, then start the game", async function () {
      // Initially, gameState should be WaitingPlayers (GameState enum value 0).
      expect(await battleship.gameState()).to.equal(0);

      // First player joins.
      await expect(battleship.connect(player1).join())
        .to.emit(battleship, "GameJoined")
        .withArgs(player1.address);

      // Still WaitingPlayers since only one player has joined.
      expect(await battleship.gameState()).to.equal(0);

      // Second player joins.
      await expect(battleship.connect(player2).join())
        .to.emit(battleship, "GameJoined")
        .withArgs(player2.address);

      // Now the game state moves into CommitPhase (enum value 1).
      expect(await battleship.gameState()).to.equal(1);

      let [proof, publicSignals] = await commitBattleshipGrid();

      const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);

      const argv = calldata.replace(/["[\]\s]/g, "").split(",");
    
      // Extract parameters for the verifier contract
      const pi_a = [argv[0], argv[1]];
      const pi_b = [
          [argv[2], argv[3]],
          [argv[4], argv[5]]
      ];
      const pi_c = [argv[6], argv[7]];
      const inputs = argv.slice(8);

      // // --- Commit grid phase ---
      console.log("Player 1 committing grid...");
      await expect(
        battleship.connect(player1).commitGrid(pi_a, pi_b, pi_c, inputs)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player1.address);

      // For player2, we set the commitment to [333, 444]
      await expect(
        battleship.connect(player2).commitGrid(pi_a, pi_b, pi_c, inputs)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player2.address);

      // After both commitments, the game should automatically start (GameState.Playing = 2)
      expect(await battleship.gameState()).to.equal(2);
      expect(await battleship.currentAttacker()).to.equal(player1.address);
      expect(await battleship.currentDefender()).to.equal(player2.address);
    });
  });

  // describe("Gameplay actions", function () {
  //   // This hook joins and commits for both players so that the game is in Playing state.
  //   beforeEach(async function () {
  //     await battleship.connect(player1).join();
  //     await battleship.connect(player2).join();

  //     const pA = [0, 0];
  //     const pB = [
  //       [0, 0],
  //       [0, 0],
  //     ];
  //     const pC = [0, 0];

  //     // Set commitments: player1 -> [111, 222] and player2 -> [333, 444]
  //     const pubSignalsPlayer1 = [111, 222];
  //     await battleship.connect(player1).commitGrid(pA, pB, pC, pubSignalsPlayer1);
  //     const pubSignalsPlayer2 = [333, 444];
  //     await battleship.connect(player2).commitGrid(pA, pB, pC, pubSignalsPlayer2);
  //   });

  //   it("should allow an attacker to attack and defender to submit a valid proof", async function () {
  //     // Game is now in Playing state with player1 as currentAttacker.
  //     // Player1 calls attack at coordinates (2, 3).
  //     await expect(battleship.connect(player1).attack(2, 3))
  //       .to.emit(battleship, "AttackCommitted")
  //       .withArgs(player1.address, 2, 3);

  //     // After the attack, the game phase becomes Proof (enum value 1).
  //     expect(await battleship.currentPhase()).to.equal(1);

  //     // --- Defender submits proof ---
  //     // Prepare dummy proof parameters:
  //     // pA, pB, pC are dummy arrays.
  //     // pubSignals is a 5-element array:
  //     //   [0]: hit indicator (set to 1 for a hit)
  //     //   [1] & [2]: must match defender's commitment [333, 444]
  //     //   [3] & [4]: must equal the attack coordinates (2, 3)
  //     const pA = [0, 0];
  //     const pB = [
  //       [0, 0],
  //       [0, 0],
  //     ];
  //     const pC = [0, 0];
  //     const pubSignals = [1, 333, 444, 2, 3];

  //     await expect(
  //       battleship.connect(player2).submitProof(pA, pB, pC, pubSignals)
  //     )
  //       .to.emit(battleship, "ProofSubmitted")
  //       .withArgs(player2.address, 1);

  //     // Since the hit indicator is 1, the attacker (player1) gains a point.
  //     expect(await battleship.scores(player1.address)).to.equal(1);

  //     // Roles swap: now currentAttacker becomes player2 and currentDefender becomes player1.
  //     expect(await battleship.currentAttacker()).to.equal(player2.address);
  //     expect(await battleship.currentDefender()).to.equal(player1.address);

  //     // The phase reverts back to Attack.
  //     expect(await battleship.currentPhase()).to.equal(0);
  //   });

  //   it("should declare game over if the attacker times out in the attack phase", async function () {
  //     // In the Attack phase, if the turn deadline expires without an attack, timeout() should
  //     // end the game and declare the currentDefender as the winner.
  //     // Obtain the current turn deadline.
  //     const currentDeadline = await battleship.currentTurnDeadline();
  //     const currentBlock = await ethers.provider.getBlockNumber();
  //     // Mine enough blocks (currentDeadline - currentBlock + 1 blocks) to pass the deadline.
  //     await mineBlocks(currentDeadline.toNumber() - currentBlock + 1);

  //     await expect(battleship.timeout())
  //       .to.emit(battleship, "GameOver")
  //       .withArgs(await battleship.currentDefender());

  //     expect(await battleship.gameState()).to.equal(3); // GameOver (enum value 3)
  //   });

  //   it("should handle proof timeout and switch the turn after the proof phase times out", async function () {
  //     // First, the attacker (player1) makes an attack.
  //     await battleship.connect(player1).attack(4, 5);
  //     expect(await battleship.currentPhase()).to.equal(1); // Proof phase now.

  //     // Let's simulate proof timeout:
  //     const currentDeadline = await battleship.currentTurnDeadline();
  //     const currentBlock = await ethers.provider.getBlockNumber();
  //     await mineBlocks(currentDeadline.toNumber() - currentBlock + 1);

  //     // In Proof phase, if timeout occurs, the contract increments the score for the attacker,
  //     // emits a ProofSubmitted event and swaps roles.
  //     await expect(battleship.timeout())
  //       .to.emit(battleship, "ProofSubmitted")
  //       .withArgs(player2.address, 1);

  //     // The attacker (player1) should have his score incremented.
  //     expect(await battleship.scores(player1.address)).to.equal(1);

  //     // Roles should swap.
  //     expect(await battleship.currentAttacker()).to.equal(player2.address);
  //     expect(await battleship.currentDefender()).to.equal(player1.address);

  //     // Phase resets back to Attack.
  //     expect(await battleship.currentPhase()).to.equal(0);
  //   });
  // });
});


const initBattleship = async () => {
  const Battleship = await ethers.getContractFactory("Battleship");
  battleship = await Battleship.deploy(
    await battleshipVerifier.getAddress(),
    await gridPosVerifier.getAddress()
  );
  await battleship.waitForDeployment();
};