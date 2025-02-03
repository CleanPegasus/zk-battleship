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
    "build/battleship_keys/battleship_0001.zkey"
  );
  return [proof, publicSignals];
}

async function generateGridPosProof(circuitInputs) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs,
    "build/verifybattleship_js/verifybattleship.wasm",
    "build/verifybattleship_keys/verifybattleship_0001.zkey"
  );
  return [proof, publicSignals];
}

async function formatProofForVerifier(proof, publicSignals) {
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const argv = calldata.replace(/["[\]\s]/g, "").split(",");

  // Return parameters in the proper structure.
  return {
    pA: [argv[0], argv[1]],
    pB: [
      [argv[2], argv[3]],
      [argv[4], argv[5]]
    ],
    pC: [argv[6], argv[7]],
    pubSignals: argv.slice(8).map((s) => s)
  };
}

async function commitBattleshipGrid() {
  const carrier = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0]
  ];

  // Battleship (size 4) at row 1, columns 0 to 3
  const battleship = [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1]
  ];

  // Cruiser (size 3) at row 2, columns 0 to 2
  const cruiser = [
    [0, 2],
    [1, 2],
    [2, 2]
  ];

  // Submarine (size 3) at row 3, columns 0 to 2
  const submarine = [
    [0, 3],
    [1, 3]
  ];

  // Destroyer (size 2) at row 4, columns 0 to 1
  const destroyer = [
    [0, 4],
    [1, 4]
  ];

  const salt = 12345;

  const grid = Array(10)
    .fill()
    .map(() => Array(10).fill("0"));

  // Place ships on grid with their sizes
  carrier.forEach(([x, y]) => (grid[x][y] = "5")); // Carrier - 5
  battleship.forEach(([x, y]) => (grid[x][y] = "4")); // Battleship - 4
  cruiser.forEach(([x, y]) => (grid[x][y] = "3")); // Cruiser - 3
  submarine.forEach(([x, y]) => (grid[x][y] = "2")); // Submarine - 2
  destroyer.forEach(([x, y]) => (grid[x][y] = "1")); // Destroyer - 1

  const circuitInputs = {
    carrier,
    battleship,
    cruiser,
    submarine,
    destroyer,
    salt
  };

  const [proof, publicSignals] = await generateBattleshipProof(circuitInputs);
  return [proof, publicSignals, grid, salt];
}

describe("Battleship Contract", function () {
  let battleship;
  let battleshipVerifier;
  let gridPosVerifier;
  let player1, player2, others;

  beforeEach(async function () {
    // Get signers.
    [player1, player2, ...others] = await hre.ethers.getSigners();

    // Deploy dummy verifiers (their implementations always return true).
    const BattleshipGroth16Verifier = await hre.ethers.getContractFactory(
      "BattleshipGroth16Verifier"
    );
    battleshipVerifier = await BattleshipGroth16Verifier.deploy();
    await battleshipVerifier.waitForDeployment();

    const GridPosGroth16Verifier = await hre.ethers.getContractFactory(
      "GridPosGroth16Verifier"
    );
    gridPosVerifier = await GridPosGroth16Verifier.deploy();
    await gridPosVerifier.waitForDeployment();

    console.log(
      "BattleshipGroth16Verifier deployed to:",
      await battleshipVerifier.getAddress()
    );
    console.log(
      "GridPosGroth16Verifier deployed to:",
      await gridPosVerifier.getAddress()
    );

    // Deploy the Battleship contract with the dummy verifier addresses.
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

      // Still waiting for the second player.
      expect(await battleship.gameState()).to.equal(0);

      // Second player joins.
      await expect(battleship.connect(player2).join())
        .to.emit(battleship, "GameJoined")
        .withArgs(player2.address);

      // Now the game enters CommitPhase (enum value 1).
      expect(await battleship.gameState()).to.equal(1);

      let [proof, publicSignals, _grid, _salt] = await commitBattleshipGrid();
      const formattedProof = await formatProofForVerifier(proof, publicSignals);
      const { pA, pB, pC, pubSignals } = formattedProof;

      // Player 1 commits grid.
      await expect(
        battleship.connect(player1).commitGrid(pA, pB, pC, pubSignals)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player1.address);

      // Player 2 commits grid.
      await expect(
        battleship.connect(player2).commitGrid(pA, pB, pC, pubSignals)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player2.address);

      // After both commitments, the game automatically starts (GameState.Playing = 2).
      expect(await battleship.gameState()).to.equal(2);
      expect(await battleship.currentAttacker()).to.equal(player1.address);
      expect(await battleship.currentDefender()).to.equal(player2.address);
    });

    it("should not allow a player to commit their grid twice", async function () {
      // Setup: Both players join.
      await battleship.connect(player1).join();
      await battleship.connect(player2).join();
      let [proof, publicSignals] = await commitBattleshipGrid();
      const formattedProof = await formatProofForVerifier(proof, publicSignals);
      const { pA, pB, pC, pubSignals } = formattedProof;

      // First commit by player1 should succeed.
      await expect(
        battleship.connect(player1).commitGrid(pA, pB, pC, pubSignals)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player1.address);

      // A second commit by player1 should revert.
      await expect(
        battleship.connect(player1).commitGrid(pA, pB, pC, pubSignals)
      ).to.be.revertedWith("Already committed");
    });

    it("should not allow a non-player to join when the game has already started", async function () {
      // Two players join.
      await battleship.connect(player1).join();
      await battleship.connect(player2).join();
      // Game state is now CommitPhase, so any additional join should revert.
      await expect(battleship.connect(others[0]).join()).to.be.revertedWith(
        "Game already started"
      );
    });

    it("should revert a grid commitment if the commit deadline has passed", async function () {
      // Join game.
      await battleship.connect(player1).join();
      await battleship.connect(player2).join();

      // Mine enough blocks to pass the commit deadline.
      await mineBlocks(121);

      let [proof, publicSignals] = await commitBattleshipGrid();
      const formattedProof = await formatProofForVerifier(proof, publicSignals);
      const { pA, pB, pC, pubSignals } = formattedProof;

      // Now commit should revert due to expired commit deadline.
      await expect(
        battleship.connect(player1).commitGrid(pA, pB, pC, pubSignals)
      ).to.be.revertedWith("Commit deadline passed");
    });
  });

  describe("Gameplay actions", function () {
    let grid;
    let salt;

    // This hook joins and commits for both players so that the game is in Playing state.
    beforeEach(async function () {
      await battleship.connect(player1).join();
      await battleship.connect(player2).join();

      let [proof, publicSignals, _grid, _salt] = await commitBattleshipGrid();
      grid = _grid;
      salt = _salt;
      const formattedProof = await formatProofForVerifier(proof, publicSignals);
      const { pA, pB, pC, pubSignals } = formattedProof;

      // Commit grid for both players.
      await expect(
        battleship.connect(player1).commitGrid(pA, pB, pC, pubSignals)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player1.address);

      await expect(
        battleship.connect(player2).commitGrid(pA, pB, pC, pubSignals)
      )
        .to.emit(battleship, "CommitmentSubmitted")
        .withArgs(player2.address);
    });

    it("should allow an attacker to attack and defender to submit a valid proof", async function () {
      // Game is now in Playing state with player1 as currentAttacker.
      // Player1 attacks at coordinates (2, 3).
      console.log("Player 1 attacking...");
      let p = [2, 3];
      await expect(battleship.connect(player1).attack(2, 3))
        .to.emit(battleship, "AttackCommitted")
        .withArgs(player1.address, 2, 3);

      // After the attack, the phase becomes Proof.
      expect(await battleship.currentPhase()).to.equal(1);

      console.log("Player 2 submitting proof...");
      let circuitInputs = {
        grid,
        salt,
        p
      };

      const [proof, publicSignals] = await generateGridPosProof(circuitInputs);
      const formattedProof = await formatProofForVerifier(proof, publicSignals);
      const { pA, pB, pC, pubSignals } = formattedProof;

      // Defender submits proof.
      await expect(
        battleship.connect(player2).submitProof(pA, pB, pC, pubSignals)
      )
        .to.emit(battleship, "ProofSubmitted")
        .withArgs(player2.address, 0);

      expect(await battleship.scores(player1.address)).to.equal(0);
      expect(await battleship.scores(player2.address)).to.equal(0);

      // Now player2 attacks.
      console.log("Player 2 attacking...");
      p = [0, 0];
      await expect(battleship.connect(player2).attack(0, 0))
        .to.emit(battleship, "AttackCommitted")
        .withArgs(player2.address, 0, 0);

      console.log("Player 1 submitting proof...");
      circuitInputs = {
        grid,
        salt,
        p
      };

      const [proof1, publicSignals1] = await generateGridPosProof(circuitInputs);
      const formattedProof1 = await formatProofForVerifier(proof1, publicSignals1);
      await expect(
        battleship.connect(player1).submitProof(
          formattedProof1.pA,
          formattedProof1.pB,
          formattedProof1.pC,
          formattedProof1.pubSignals
        )
      )
        .to.emit(battleship, "ProofSubmitted")
        .withArgs(player1.address, 5);

      expect(await battleship.scores(player1.address)).to.equal(0);
      expect(await battleship.scores(player2.address)).to.equal(1);
    });

    it("should declare game over if the attacker times out in the attack phase", async function () {
      // In the Playing state the attacker (player1) must attack in time.
      // We simply wait past the current turn deadline without an attack.
      await mineBlocks(21);

      // Calling timeout() during Attack phase should end the game in favor of the defender.
      await expect(battleship.timeout())
        .to.emit(battleship, "GameOver")
        .withArgs(player2.address);

      // Game state should now be GameOver (enum value 3).
      expect(await battleship.gameState()).to.equal(3);
    });

    it("should handle proof timeout and switch the turn after the proof phase times out", async function () {
      // Player1 attacks so that the game enters the proof phase.
      await expect(battleship.connect(player1).attack(2, 3))
        .to.emit(battleship, "AttackCommitted")
        .withArgs(player1.address, 2, 3);
      expect(await battleship.currentPhase()).to.equal(1);

      // Wait until proof deadline passes.
      await mineBlocks(21);
      // When defender does not submit a proof in time, the timeout should increment the attacker's score,
      // emit a ProofSubmitted event, and switch attacker/defender.
      await expect(battleship.timeout())
        .to.emit(battleship, "ProofSubmitted")
        .withArgs(player2.address, 1);

      // Check that the attacker's score (player1) is increased by one.
      expect(await battleship.scores(player1.address)).to.equal(1);

      // Roles should be switched.
      expect(await battleship.currentAttacker()).to.equal(player2.address);
      expect(await battleship.currentDefender()).to.equal(player1.address);

      // The phase should now be set back to Attack.
      expect(await battleship.currentPhase()).to.equal(0);
      // Game state remains Playing.
      expect(await battleship.gameState()).to.equal(2);
    });

    describe("Invalid actions", function () {
      it("should revert attack if called by a non-current attacker", async function () {
        // Current attacker is player1.
        await expect(
          battleship.connect(player2).attack(3, 3)
        ).to.be.revertedWith("Not your turn");
      });

      it("should revert attack with invalid coordinates", async function () {
        // Coordinates must be less than 10.
        await expect(battleship.connect(player1).attack(10, 0)).to.be.revertedWith(
          "Invalid coordinates"
        );
        await expect(battleship.connect(player1).attack(0, 10)).to.be.revertedWith(
          "Invalid coordinates"
        );
      });

      it("should revert an attack if the game is not in Attack phase", async function () {
        // Trigger an attack so that the phase is set to Proof.
        await battleship.connect(player1).attack(2, 3);
        expect(await battleship.currentPhase()).to.equal(1);
        // Trying to attack again while in Proof phase should revert.
        await expect(
          battleship.connect(player1).attack(0, 0)
        ).to.be.revertedWith("Not attack phase");
      });

      it("should revert submitProof if called by someone other than the defender", async function () {
        // Player1 attacks (game enters Proof phase).
        await battleship.connect(player1).attack(2, 3);
        expect(await battleship.currentPhase()).to.equal(1);

        let circuitInputs = {
          grid,
          salt,
          p: [2, 3]
        };
        const [proof, publicSignals] = await generateGridPosProof(circuitInputs);
        const formattedProof = await formatProofForVerifier(proof, publicSignals);
        // If attacker (player1) tries to call submitProof instead of defender (player2),
        // it should revert.
        await expect(
          battleship.connect(player1).submitProof(
            formattedProof.pA,
            formattedProof.pB,
            formattedProof.pC,
            formattedProof.pubSignals
          )
        ).to.be.revertedWith("Not your turn");
      });

      it("should revert submitProof when the commitment does not match", async function () {
        // Player1 attacks.
        await battleship.connect(player1).attack(2, 3);
        expect(await battleship.currentPhase()).to.equal(1);

        grid[2][3] = "5";

        let circuitInputs = {
          grid,
          salt,
          p: [2, 3]
        };
        const [proof, publicSignals] = await generateGridPosProof(circuitInputs);
        let formattedProof = await formatProofForVerifier(proof, publicSignals);
        
        await expect(
          battleship.connect(player2).submitProof(
            formattedProof.pA,
            formattedProof.pB,
            formattedProof.pC,
            formattedProof.pubSignals
          )
        ).to.be.revertedWith("Invalid commitment");
      });

      it("should revert submitProof if the attack coordinates do not match", async function () {
        // Player1 attacks at (2,3).
        await battleship.connect(player1).attack(2, 3);
        expect(await battleship.currentPhase()).to.equal(1);

        let circuitInputs = {
          grid,
          salt,
          p: [0, 0] // Invalid coordinates
        };
        const [proof, publicSignals] = await generateGridPosProof(circuitInputs);
        let formattedProof = await formatProofForVerifier(proof, publicSignals);

        await expect(
          battleship.connect(player2).submitProof(
            formattedProof.pA,
            formattedProof.pB,
            formattedProof.pC,
            formattedProof.pubSignals
          )
        ).to.be.revertedWith("Invalid attack coordinates");
      });
    });
  });
});
