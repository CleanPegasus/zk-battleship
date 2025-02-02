pragma circom  2.1.6;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";

// b is the board length. b = 10 (10 x 10)
template PointConstraint(b) {
  signal input x;
  signal input y;

  signal boardLength  <== b;

  component gte[2];
  component lt[2];

  gte[0] = GreaterEqThan(8);
  gte[0].in[0] <== x;
  gte[0].in[1] <== 0;

  gte[0].out === 1;

  lt[0] = LessThan(8);
  lt[0].in[0] <== x;
  lt[0].in[1] <== boardLength;


  lt[0].out === 1;

  gte[1] = GreaterEqThan(8);
  gte[1].in[0] <== y;
  gte[1].in[1] <== 0;

  gte[1].out === 1;

  lt[1] = LessThan(8);
  lt[1].in[0] <== y;
  lt[1].in[1] <== boardLength;

  lt[1].out === 1;
}


// all points either have to be horizontal or vertical
// distance between i and i+1 has to be 1
template AlignmentConstraint(n) {
  // signal input x[n];
  // signal input y[n];
  signal input p[n][2];

  signal x_out[n];
  signal y_out[n];

  signal x_0 <== p[0][0]; // first x coordinate
  signal y_0 <== p[0][1]; // first y coordinate

  x_out[0] <== 0;
  y_out[0] <== 0;

  for(var i=1; i<n; i++) {
    x_out[i] <== x_out[i-1] + (x_0 - p[i][0]);
    y_out[i] <== y_out[i-1] + (y_0 - p[i][1]);

    (p[i-1][0] - p[i][0] + 1) * (p[i-1][1] - p[i][1] + 1) === 0; // check if the distance between the current point and the next point is 1
  }

  x_out[n-1] * y_out[n-1] === 0;
}

template ShipConstraints(b, n) {
  signal input p[n][2];

  component pointConstraint[n];

  for(var i=0; i<n; i++) {
    pointConstraint[i] = PointConstraint(b);
    pointConstraint[i].x <== p[i][0];
    pointConstraint[i].y <== p[i][1];
  }

  component alignmentConstraint = AlignmentConstraint(n);

  alignmentConstraint.p <== p;

}

template ComparePoints() {
  signal input p1[2];
  signal input p2[2];

  component ise[2];

  ise[0] = IsEqual();
  ise[0].in <== p1;
  
  ise[1] = IsEqual();
  ise[1].in <== p2;

  ise[0].out * ise[1].out === 0;
}

template IsShipOnPoint(n) { // n -> ship size
  signal input ship[n][2];
  signal input x;
  signal input y;

  signal output out;

  signal tmp[n];

  component isz[n][2];

  isz[0][0] = IsZero();
  isz[0][0].in <== x - ship[0][0];

  isz[0][1] = IsZero();
  isz[0][1].in <== y - ship[0][1];

  tmp[0] <== (1 - isz[0][0].out) + (1 - isz[0][1].out);

  for(var i = 1; i<n; i++) {

    isz[i][0] = IsZero();
    isz[i][0].in <== x - ship[i][0];

    isz[i][1] = IsZero();
    isz[i][1].in <== y - ship[i][1];

    tmp[i] <== tmp[i-1] * ((1 - isz[i][0].out) + (1 - isz[i][1].out));
  }

  component tmpIsz = IsZero();

  tmpIsz.in <== tmp[n-1];

  out <== tmpIsz.out;

}


template BattleshipInit(b) {
  
  signal input carrier[5][2];
  signal input battleship[4][2];
  signal input cruiser[3][2];
  signal input submarine[2][2];
  signal input destroyer[2][2];

  signal input salt;

  signal output out[2];
  
  signal grid[b][b];


  component carrierConstraint = ShipConstraints(10, 5); // grid size 10 and ship size 5
  carrierConstraint.p <== carrier;

  component battleshipConstraint = ShipConstraints(10, 4);
  battleshipConstraint.p <== battleship;

  component cruiserConstraint = ShipConstraints(10, 3);
  cruiserConstraint.p <== cruiser;

  component submarineConstraint = ShipConstraints(10, 2);
  submarineConstraint.p <== submarine;

  component destroyerConstraint = ShipConstraints(10,2);
  destroyerConstraint.p <== destroyer;

  component isCarrierOnPoint[b][b];
  component isBattleshipOnPoint[b][b];
  component isCruiserOnPoint[b][b];
  component isSubmarineOnPoint[b][b];
  component isDestroyerOnPoint[b][b];

  var boardSize = b * b;
  component pedersen = Pedersen(boardSize + 1);

  signal pedersenInp[boardSize + 1];

  signal totalGridSize[boardSize];

  signal temp[b][b];

  for(var i=0; i<b; i++) {
    for(var j=0; j<b; j++) {
      log("Checking position (", i, ",", j, ")");

      isCarrierOnPoint[i][j] = IsShipOnPoint(5);
      isCarrierOnPoint[i][j].ship <== carrier;
      isCarrierOnPoint[i][j].x <== i;
      isCarrierOnPoint[i][j].y <== j;
      log("Carrier at (", i, ",", j, "): ", isCarrierOnPoint[i][j].out);      

      isBattleshipOnPoint[i][j] = IsShipOnPoint(4);
      isBattleshipOnPoint[i][j].ship <== battleship;
      isBattleshipOnPoint[i][j].x <== i;
      isBattleshipOnPoint[i][j].y <== j;
      log("Battleship at (", i, ",", j, "): ", isBattleshipOnPoint[i][j].out);

      isCruiserOnPoint[i][j] = IsShipOnPoint(3);
      isCruiserOnPoint[i][j].ship <== cruiser;
      isCruiserOnPoint[i][j].x <== i;
      isCruiserOnPoint[i][j].y <== j;
      log("Cruiser at (", i, ",", j, "): ", isCruiserOnPoint[i][j].out);

      isSubmarineOnPoint[i][j] = IsShipOnPoint(2);
      isSubmarineOnPoint[i][j].ship <== submarine;
      isSubmarineOnPoint[i][j].x <== i;
      isSubmarineOnPoint[i][j].y <== j;
      log("Submarine at (", i, ",", j, "): ", isSubmarineOnPoint[i][j].out);

      isDestroyerOnPoint[i][j] = IsShipOnPoint(2);
      isDestroyerOnPoint[i][j].ship <== destroyer;
      isDestroyerOnPoint[i][j].x <== i;
      isDestroyerOnPoint[i][j].y <== j;
      log("Destroyer at (", i, ",", j, "): ", isDestroyerOnPoint[i][j].out);


      temp[i][j] <== isCarrierOnPoint[i][j].out + isBattleshipOnPoint[i][j].out + 
                     isCruiserOnPoint[i][j].out + isSubmarineOnPoint[i][j].out + 
                     isDestroyerOnPoint[i][j].out;

      temp[i][j] * (1 - temp[i][j]) === 0;

      grid[i][j] <== 5 * isCarrierOnPoint[i][j].out + 4 * isBattleshipOnPoint[i][j].out + 
                     3 * isCruiserOnPoint[i][j].out + 2 * isSubmarineOnPoint[i][j].out + 
                     1 * isDestroyerOnPoint[i][j].out;

      pedersenInp[i * b + j] <== grid[i][j];
      log("------------------------");
    }
  }

  // Add grid logging
  log("Final Grid State:");
  log("   0  1  2  3  4  5  6  7  8  9");
  for(var i=0; i<b; i++) {
    log(i, ":", grid[i][0], " ", grid[i][1], " ", grid[i][2], " ", grid[i][3], " ", 
           grid[i][4], " ", grid[i][5], " ", grid[i][6], " ", grid[i][7], " ", 
           grid[i][8], " ", grid[i][9]);
  }

  pedersenInp[boardSize] <== salt;

  pedersen.in <== pedersenInp;

  out <== pedersen.out;

  log("out");
  log(out[0]);
  log(out[1]);

}

component main = BattleshipInit(10);