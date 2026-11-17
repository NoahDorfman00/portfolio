// Flat backplate for a Raspberry Pi 3 B, bolted on with the case's four nylon bolts and nuts,
// stuck to the screen with Velcro. Bolt heads sit in pockets on the Velcro face so that face stays flat.
// Prints Velcro face down, no supports.

board    = [85, 56];
holes    = [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]];
corner_r = 3;

bolt_d   = 3.3;    // clearance for the case's nylon bolts (2.87 mm across the threads)
head_d   = 6.3;    // pocket for the 5.5 mm bolt head
head_dp  = 2.6;    // pocket depth: head height plus a little
edge     = 1;      // plate beyond the board all round, so the head pockets keep a wall
floor_t  = 1.3;    // plate left under the head
stand_h  = 3;      // air under the board for solder joints and the SD slot
stand_d  = 6.5;

plate_t  = head_dp + floor_t;
$fn = 48; eps = 0.01;

// bolt length needed under the head, for reference
echo(min_bolt_length = floor_t + stand_h + 1.5 + 2);

difference() {
  union() {
    hull() for (x = [corner_r - edge, board[0] + edge - corner_r], y = [corner_r - edge, board[1] + edge - corner_r])
      translate([x, y, 0]) cylinder(r = corner_r, h = plate_t);
    for (p = holes) translate([p[0], p[1], 0]) cylinder(d = stand_d, h = plate_t + stand_h);
  }
  for (p = holes) translate([p[0], p[1], 0]) {
    translate([0, 0, -eps]) cylinder(d = head_d, h = head_dp + eps);
    // one sacrificial layer over the pocket so the small hole bridges cleanly; the bolt pokes through it
    translate([0, 0, head_dp + 0.2]) cylinder(d = bolt_d, h = 20);
  }
}
