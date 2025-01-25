pragma circom  2.1.6;

include "../node_modules/circomlib/circuits/comparators.circom";


template PointConstraint() {
  signal input x;
  signal input y;

  component gte[2];
  component lt[2];

  gte[0] = GreaterEqThan(8);
  gte[0].in[0] <== x;
  gte[0].in[1] <== 0;

  lt[0] = LessThan(8);
  lt[0].in[0] <== x;
  lt[0].in[1] <== 7;

  gte[1] = GreaterEqThan(8);
  gte[1].in[0] <== y;
  gte[1].in[1] <== 0;

  lt[1] = LessThan(8);
  lt[1].in[0] <== y;
  lt[1].in[1] <== 7;
}


// No 2 points should be the same
// all points either have to be horizontal or vertical
template AlignmentConstraint(n) {
  signal input x[n];
  signal input y[n];

  signal x_out[n];
  signal y_out[n];

  signal output out;

  signal x_0 <== x[0];
  signal y_0 <== y[0];

  x_out[0] <== 0;
  y_out[0] <== 0;

  for(var i=1; i<n; i++) {
    x_out[i] <== x_out[i-1] + (x_0 - x[i]);
    y_out[i] <== y_out[i-1] + (y_0 - y[i]);
  }

  out <== x_out[n-1] * y_out[n-1];

}



// template CheckAlignment(n) {
//   signal input 
// }


// template BattleshipInit() {
//   signal board[10][10];


  
// }

// component main = PointValidation();
component main = AlignmentConstraint(3);