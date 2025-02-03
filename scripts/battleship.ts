import {
  ethers,
  Contract,
  ContractTransaction,
  Signer,
} from "ethers";
import * as snarkjs from "snarkjs";
import battleshipArtifact from "../artifacts/contracts/Battleship.sol/Battleship.json";

/**
 * Game states for the Battleship contract.
 */
export enum GameState {
  WaitingPlayers, // 0
  CommitPhase,    // 1
  Playing,        // 2
  GameOver,       // 3
}

/**
 * Gameplay phases.
 */
export enum Phase {
  Attack, // 0
  Proof,  // 1
}

/**
 * Structure for the formatted proof data.
 */
export interface ProofData {
  pA: [string, string];
  pB: [[string, string], [string, string]];
  pC: [string, string];
  pubSignals: (string | number)[];
}

/**
 * ShipCoordinates represents the ship placement on the grid.
 * Provide arrays for each ship type (each coordinate must be within [0, 9]).
 */
export interface ShipCoordinates {
  carrier: [number, number][];
  battleship: [number, number][];
  cruiser: [number, number][];
  submarine: [number, number][];
  destroyer: [number, number][];
}

/**
 * BattleshipSDK is a wrapper for interacting with the Battleship
 * contract. It provides methods to join the game, commit a grid using
 * zk‑SNARK proofs, attack, submit proofs, manage timeouts, and subscribe
 * to events.
 */
export class BattleshipSDK {
  private contract: Contract;

  /**
   * Creates an instance of BattleshipSDK.
   *
   * @param signer An ethers.js Signer instance.
   * @param address The Battleship contract address.
   */
  constructor(signer: Signer, address: string) {
    this.contract = new ethers.Contract(address, battleshipArtifact.abi, signer);
  }

  // Contract interaction functions

  /**
   * Join the game.
   */
  async join(): Promise<ContractTransaction> {
    return this.contract.join();
  }

  /**
   * Commit your Battleship grid.  
   *  
   * This function accepts the ship coordinates (for each ship type) and a salt.
   * It computes a 10×10 grid where empty cells are represented as "0" and for each ship,
   * the value used is determined by the following mapping:
   *  
   *   • carrier: "5"  
   *   • battleship: "4"  
   *   • cruiser: "3"  
   *   • submarine: "2"  
   *   • destroyer: "1"  
   *  
   * It then builds the circuit inputs, generates the zk‑SNARK proof, and submits the
   * commitment. The function returns the transaction, computed grid, and salt.
   *
   * @param shipCoordinates An object with the ship coordinates.
   * @param salt A numeric salt.
   */
  async commitGrid(
    shipCoordinates: ShipCoordinates,
    salt: number
  ): Promise<{ tx: ContractTransaction; grid: string[][]; salt: number }> {
    // Create a 10x10 grid with "0" (empty cells)
    const grid: string[][] = Array.from({ length: 10 }, () =>
      Array(10).fill("0")
    );

    // Predefined mapping for ship types to grid cell value.
    const shipMapping: Record<keyof ShipCoordinates, string> = {
      carrier: "5",
      battleship: "4",
      cruiser: "3",
      submarine: "2",
      destroyer: "1",
    };

    // Place each ship on the grid.
    for (const shipType of Object.keys(shipCoordinates) as (keyof ShipCoordinates)[]) {
      const coords = shipCoordinates[shipType];
      for (const coord of coords) {
        const [x, y] = coord;
        if (x < 0 || x >= 10 || y < 0 || y >= 10) {
          throw new Error(
            `Invalid coordinate for ${shipType}: [${x}, ${y}]. Must be in [0,9].`
          );
        }
        grid[x][y] = shipMapping[shipType];
      }
    }

    // Build circuit inputs for the Battleship grid commitment.
    // The circuit expects the ship arrays and salt.
    const circuitInputs = { ...shipCoordinates, salt };

    // Generate the battleship proof.
    const proofData = await BattleshipSDK.generateBattleshipProof(circuitInputs);

    // Submit the commitGrid transaction using the proof.
    const tx: ContractTransaction = await this.contract.commitGrid(
      proofData.pA,
      proofData.pB,
      proofData.pC,
      proofData.pubSignals
    );

    return { tx, grid, salt };
  }

  /**
   * Submit a proof in response to an attack.
   *
   * This function accepts the grid (as computed when committing), the salt used,
   * and the coordinates of the attack. It computes the circuit inputs for the grid
   * position proof, generates the proof, and submits it.
   *
   * @param grid The 10×10 grid (array of arrays of string values).
   * @param salt The salt used when committing the grid.
   * @param coordinates The attack coordinates [x, y].
   */
  async submitProof(
    grid: string[][],
    salt: number,
    coordinates: [number, number]
  ): Promise<ContractTransaction> {
    // Build circuit inputs with grid, salt, and attack coordinate (named "p")
    const circuitInputs = { grid, salt, p: coordinates };

    // Generate the grid position proof.
    const proofData = await BattleshipSDK.generateGridPosProof(circuitInputs);

    // Submit the proof transaction.
    return this.contract.submitProof(
      proofData.pA,
      proofData.pB,
      proofData.pC,
      proofData.pubSignals
    );
  }

  /**
   * Attack at the given coordinates.
   *
   * @param x x coordinate (must be less than 10).
   * @param y y coordinate (must be less than 10).
   */
  async attack(x: number, y: number): Promise<ContractTransaction> {
    return this.contract.attack(x, y);
  }

  /**
   * Call timeout. Use this when deadlines expire.
   */
  async timeout(): Promise<ContractTransaction> {
    return this.contract.timeout();
  }

  // Getters

  /**
   * Retrieve the current game state.
   */
  async getGameState(): Promise<GameState> {
    const state: BigInt = await this.contract.gameState();
    return Number(state);
  }

  /**
   * Retrieve the current gameplay phase.
   */
  async getCurrentPhase(): Promise<Phase> {
    const phase: BigInt = await this.contract.currentPhase();
    return Number(phase);
  }

  /**
   * Get the current attacker's address.
   */
  async getCurrentAttacker(): Promise<string> {
    return this.contract.currentAttacker();
  }

  /**
   * Get the current defender's address.
   */
  async getCurrentDefender(): Promise<string> {
    return this.contract.currentDefender();
  }

  /**
   * Get the commit deadline (in block number).
   */
  async getCommitDeadline(): Promise<BigInt> {
    return this.contract.commitDeadline();
  }

  /**
   * Get the current turn deadline (in block number).
   */
  async getCurrentTurnDeadline(): Promise<BigInt> {
    return this.contract.currentTurnDeadline();
  }

  /**
   * Retrieve the score for a given player address.
   *
   * @param player The player's address.
   */
  async getScore(player: string): Promise<BigInt> {
    return this.contract.scores(player);
  }

  // Event listeners

  onGameJoined(callback: (player: string) => void): void {
    this.contract.on("GameJoined", (player: string) => callback(player));
  }

  onCommitmentSubmitted(callback: (player: string) => void): void {
    this.contract.on("CommitmentSubmitted", (player: string) => {
      callback(player);
    });
  }

  onGameStarted(callback: () => void): void {
    this.contract.on("GameStarted", () => callback());
  }

  onAttackCommitted(
    callback: (attacker: string, x: BigInt, y: BigInt) => void
  ): void {
    this.contract.on("AttackCommitted", (attacker: string, x, y) => {
      callback(attacker, BigInt(x), BigInt(y));
    });
  }

  onProofSubmitted(
    callback: (defender: string, hit: BigInt) => void
  ): void {
    this.contract.on("ProofSubmitted", (defender: string, hit) => {
      callback(defender, BigInt(hit));
    });
  }

  onGameOver(callback: (winner: string) => void): void {
    this.contract.on("GameOver", (winner: string) => callback(winner));
  }

  removeAllListeners(): void {
    this.contract.removeAllListeners();
  }

  // Static helper functions to generate and format proofs using snarkjs

  /**
   * Format the proof and public signals into the structure
   * expected by the contract.
   *
   * @param proof The proof object from snarkjs.
   * @param publicSignals The corresponding public signals.
   * @returns A formatted ProofData object.
   */
  static async formatProofForVerifier(
    proof: any,
    publicSignals: any
  ): Promise<ProofData> {
    const callData: string = await snarkjs.groth16.exportSolidityCallData(
      proof,
      publicSignals
    );
    // Remove extraneous characters and split by commas.
    const args = callData
      .replace(/["[\]\s]/g, "")
      .split(",")
      .filter((x) => x !== "");
    const formattedProof: ProofData = {
      pA: [args[0], args[1]],
      pB: [
        [args[2], args[3]],
        [args[4], args[5]],
      ],
      pC: [args[6], args[7]],
      pubSignals: args.slice(8),
    };
    return formattedProof;
  }

  /**
   * Generate a battleship grid commitment proof.
   *
   * @param circuitInputs The inputs for the battleship circuit.
   * @param wasmPath Optional path to the WASM file.
   * @param zkeyPath Optional path to the zkey file.
   * @returns A formatted ProofData object.
   */
  static async generateBattleshipProof(
    circuitInputs: any,
    wasmPath: string = "build/battleship_js/battleship.wasm",
    zkeyPath: string = "build/battleship_keys/battleship_0001.zkey"
  ): Promise<ProofData> {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath
    );
    return BattleshipSDK.formatProofForVerifier(proof, publicSignals);
  }

  /**
   * Generate a grid position proof.
   *
   * @param circuitInputs The inputs for the grid position circuit.
   * @param wasmPath Optional path to the WASM file.
   * @param zkeyPath Optional path to the zkey file.
   * @returns A formatted ProofData object.
   */
  static async generateGridPosProof(
    circuitInputs: any,
    wasmPath: string = "build/verifybattleship_js/verifybattleship.wasm",
    zkeyPath: string = "build/verifybattleship_keys/verifybattleship_0001.zkey"
  ): Promise<ProofData> {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath
    );
    return BattleshipSDK.formatProofForVerifier(proof, publicSignals);
  }
}
