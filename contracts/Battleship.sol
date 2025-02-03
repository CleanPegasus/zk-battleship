// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Battleship {
    enum GameState { WaitingPlayers, CommitPhase, Playing, GameOver }
    enum Phase { Attack, Proof }
    
    address public player1;
    address public player2;
    GameState public gameState;
    Phase public currentPhase;
    
    uint public commitDeadline;
    uint public currentTurnDeadline;
    
    mapping(address => bytes32) public commitments;
    mapping(address => uint) public scores;
    
    address public currentAttacker;
    address public currentDefender;
    
    uint public currentAttackX;
    uint public currentAttackY;
    
    uint public constant MAX_SCORE = 17;
    
    event GameJoined(address player);
    event CommitmentSubmitted(address player);
    event GameStarted();
    event AttackCommitted(address attacker, uint x, uint y);
    event ProofSubmitted(address defender, uint hit);
    event GameOver(address winner);
    
    modifier onlyPlayers() {
        require(msg.sender == player1 || msg.sender == player2, "Not a player");
        _;
    }
    
    function join() external {
        require(gameState == GameState.WaitingPlayers, "Game already started");
        require(player1 == address(0) || player2 == address(0), "Game full");
        
        if (player1 == address(0)) {
            player1 = msg.sender;
        } else {
            player2 = msg.sender;
            gameState = GameState.CommitPhase;
            commitDeadline = block.number + 120;
        }
        emit GameJoined(msg.sender);
    }
    
    function commitGrid(bytes32 commitment) external onlyPlayers {
        require(gameState == GameState.CommitPhase, "Not commit phase");
        require(commitments[msg.sender] == bytes32(0), "Already committed");
        require(block.number <= commitDeadline, "Commit deadline passed");
        
        commitments[msg.sender] = commitment;
        emit CommitmentSubmitted(msg.sender);
        
        if (commitments[player1] != bytes32(0) && commitments[player2] != bytes32(0)) {
            gameState = GameState.Playing;
            currentAttacker = player1;
            currentDefender = player2;
            currentPhase = Phase.Attack;
            currentTurnDeadline = block.number + 20;
            emit GameStarted();
        }
    }
    
    function attack(uint x, uint y) external onlyPlayers {
        require(gameState == GameState.Playing, "Game not active");
        require(currentPhase == Phase.Attack, "Not attack phase");
        require(msg.sender == currentAttacker, "Not your turn");
        require(block.number <= currentTurnDeadline, "Turn deadline passed");
        require(x < 10 && y < 10, "Invalid coordinates");
        
        currentAttackX = x;
        currentAttackY = y;
        currentPhase = Phase.Proof;
        currentTurnDeadline = block.number + 20;
        emit AttackCommitted(msg.sender, x, y);
    }
    
    function submitProof(uint hit) external onlyPlayers {
        require(gameState == GameState.Playing, "Game not active");
        require(currentPhase == Phase.Proof, "Not proof phase");
        require(msg.sender == currentDefender, "Not your turn");
        require(block.number <= currentTurnDeadline, "Proof deadline passed");
        require(hit == 0 || hit == 1, "Invalid hit value");
        
        if (hit == 1) {
            scores[currentAttacker]++;
        }
        
        emit ProofSubmitted(msg.sender, hit);
        
        if (scores[currentAttacker] >= MAX_SCORE) {
            gameState = GameState.GameOver;
            emit GameOver(currentAttacker);
        } else {
            (currentAttacker, currentDefender) = (currentDefender, currentAttacker);
            currentPhase = Phase.Attack;
            currentTurnDeadline = block.number + 20;
        }
    }
    
    function timeout() external {
        require(gameState == GameState.Playing, "Game not active");
        require(block.number > currentTurnDeadline, "Deadline not passed");
        
        if (currentPhase == Phase.Attack) {
            gameState = GameState.GameOver;
            emit GameOver(currentDefender);
        } else if (currentPhase == Phase.Proof) {
            scores[currentAttacker]++;
            emit ProofSubmitted(currentDefender, 1);
            
            if (scores[currentAttacker] >= MAX_SCORE) {
                gameState = GameState.GameOver;
                emit GameOver(currentAttacker);
            } else {
                (currentAttacker, currentDefender) = (currentDefender, currentAttacker);
                currentPhase = Phase.Attack;
                currentTurnDeadline = block.number + 20;
            }
        }
    }
}