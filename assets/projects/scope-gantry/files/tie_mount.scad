// Zip-tie anchor for a 2020 T-slot face: one M3x10 into a drop-in T-nut, one slot for the tie.
// A key on the back sits in the slot so it can't spin. Prints flat, key up, no supports. Makes three.
len = 26; wid = 11; t = 3.5;
key_w = 5.8; key_h = 1.2;
slot = [2, 5];
$fn = 40; eps = 0.01;
module mount() {
  difference() {
    union() {
      hull() for (x = [wid/2, len - wid/2]) translate([x, 0, 0]) cylinder(d = wid, h = t);
      translate([2, -key_w/2, t - eps]) cube([len - 13, key_w, key_h]);
    }
    translate([7, 0, -eps]) cylinder(d = 3.4, h = t + key_h + 1);
    translate([len - 6 - slot[0]/2, -slot[1]/2, -eps]) cube([slot[0], slot[1], t + 2*eps]);
  }
}
for (i = [0:2]) translate([0, i*(wid + 4), 0]) mount();
