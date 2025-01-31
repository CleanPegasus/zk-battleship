pragma circom  2.1.6;

include "../node_modules/circomlib/circuits/comparators.circom";

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

  component isz[n];
  signal tmp[n];

  isz[0] = IsZero();
  isz[0].in <== (x - ship[0][0]) + (y - ship[0][1]);

  tmp[0] <== isz[0].out;

  for(var i=1; i<n; i++) {
    isz[i] = IsZero();
    isz[i].in <== (x - ship[i][0]) + (y - ship[i][1]);
    tmp[i] <== tmp[i - 1] + isz[i].out;
  }

  0 === tmp[n-1] * (tmp[n-1] - 1);

  out <== tmp[n-1];
  
}


template BattleshipInit(b) {
  
  signal input carrier[5][2];
  signal input battleship[4][2];
  signal input cruiser[3][2];
  signal input submarine[3][2];
  signal input destroyer[2][2];
  
  signal grid[b][b];


  component carrierConstraint = ShipConstraints(10, 5); // grid size 10 and ship size 5
  carrierConstraint.p <== carrier;

  component battleshipConstraint = ShipConstraints(10, 4);
  battleshipConstraint.p <== battleship;

  component cruiserConstraint = ShipConstraints(10, 3);
  cruiserConstraint.p <== cruiser;

  component submarineConstraint = ShipConstraints(10, 3);
  submarineConstraint.p <== submarine;

  component destroyerConstraint = ShipConstraints(10,2);
  destroyerConstraint.p <== destroyer;

  component isCarrierOnPoint[b][b];
  component isBattleshipOnPoint[b][b];
  component isCruiserOnPoint[b][b];
  component isSubmarineOnPoint[b][b];
  component isDestroyerOnPoint[b][b];

  for(var i=0; i<b; i++) {
    for(var j=0; j<b; j++) {

      isCarrierOnPoint[i][j] = IsShipOnPoint(5);
      isCarrierOnPoint[i][j].ship <== carrier;
      isCarrierOnPoint[i][j].x <== i;
      isCarrierOnPoint[i][j].y <== j;

      isBattleshipOnPoint[i][j] = IsShipOnPoint(4);
      isBattleshipOnPoint[i][j].ship <== battleship;
      isBattleshipOnPoint[i][j].x <== i;
      isBattleshipOnPoint[i][j].y <== j;

      isCruiserOnPoint[i][j] = IsShipOnPoint(3);
      isCruiserOnPoint[i][j].ship <== cruiser;
      isCruiserOnPoint[i][j].x <== i;
      isCruiserOnPoint[i][j].y <== j;

      isSubmarineOnPoint[i][j] = IsShipOnPoint(3);
      isSubmarineOnPoint[i][j].ship <== submarine;
      isSubmarineOnPoint[i][j].x <== i;
      isSubmarineOnPoint[i][j].y <== j;

      isDestroyerOnPoint[i][j] = IsShipOnPoint(2);
      isDestroyerOnPoint[i][j].ship <== destroyer;
      isDestroyerOnPoint[i][j].x <== i;
      isDestroyerOnPoint[i][j].y <== j;

      grid[i][j] <== isCarrierOnPoint[i][j].out + isBattleshipOnPoint[i][j].out + isCruiserOnPoint[i][j].out + isSubmarineOnPoint[i][j].out + isDestroyerOnPoint[i][j].out;

      grid[i][j] * (grid[i][j] - 1) === 0;
    }
  }

}

// component main = ShipConstraints(10, 3);
// component main = AlignmentConstraint(4);
component main = BattleshipInit(10);