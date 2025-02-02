include "./quinselector.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";

template VerifyBattleshipPosition(b) {
  signal input grid[b][b];
  signal input salt;
  signal input p[2];

  signal output out;
  signal output gridHash[2];

  // Log the input position
  log("Verifying position: (", p[0], ",", p[1], ")");

  // Log the grid state
  log("Grid State:");
  log("   0  1  2  3  4  5  6  7  8  9");
  for(var i=0; i<b; i++) {
    log(i, ":", grid[i][0], " ", grid[i][1], " ", grid[i][2], " ", grid[i][3], " ", 
           grid[i][4], " ", grid[i][5], " ", grid[i][6], " ", grid[i][7], " ", 
           grid[i][8], " ", grid[i][9]);
  }

  component multiplexer = Multiplexer(b, b);
  multiplexer.inp <== grid;
  multiplexer.sel <== p[0];

  component quinSelector = QuinSelector(b);
  quinSelector.inp <== multiplexer.out;
  quinSelector.selector <== p[1];

  out <== quinSelector.out;
  log("Value at position (", p[0], ",", p[1], "): ", out);

  var boardSize = b * b;
  component pedersen = Pedersen(boardSize + 1);
  signal pedersenInp[boardSize + 1];

  for(var i=0; i<b; i++) {
    for(var j=0; j<b; j++) {
      pedersenInp[i * b + j] <== grid[i][j];
    }
  }

  pedersenInp[boardSize] <== salt;

  pedersen.in <== pedersenInp;

  gridHash <== pedersen.out;

}

component main {public [p]} = VerifyBattleshipPosition(10);