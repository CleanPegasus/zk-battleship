include "./quinselector.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";

template VerifyBattleshipPosition(b) {
  signal input grid[b][b];
  signal input salt;
  signal input p[2];

  signal output out;
  signal output gridHash[2];

  component multiplexer = Multiplexer(b, b);
  multiplexer.inp <== grid;
  multiplexer.sel <== p[0];

  component quinSelector = QuinSelector(b);
  quinSelector.inp <== multiplexer.out;
  quinSelector.selector <== p[1];

  out <== quinSelector.out;

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