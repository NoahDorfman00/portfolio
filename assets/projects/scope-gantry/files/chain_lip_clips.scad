// Clips for the cable chain on the shelf's upturned back lip. They hook over the top of the lip and are
// locked with M3x10 pinch screws from the shelf side (heat-set inserts in the front leg).
//  - anchor: holds the chain's fixed end tab (3x M3x10 into heat-set inserts), two pinch screws.
//  - rest:   a small shelf just under the fixed run, in case it droops over time, one pinch screw. Print several.
// The chain lies on its side against the clips' rear faces.
//
// Frame: X along the lip, Y toward you with Y=0 at the lip's rear face, Z up with Z=0 at the top of the lip.
// HANDEDNESS: with Y toward you and Z up, +X points to your LEFT as you face the bench. The chain leaves
// the anchor toward +X, so it runs LEFT from the anchor. The anchor goes about 220 mm RIGHT of the shelf's
// centre and the rests go to its left.

lip_h      = 45;     // lip height above the shelf top
lip_t      = 2.0;    // lip thickness (assumed, measure it)
slot_fit   = 0.4;
anchor_t   = 13;     // block thickness behind the lip; must match chain_cap.scad
chain_w    = 22;
chain_up   = 2;      // chain's lower edge above the shelf top; must match chain_cap.scad (chain_bot - 22)
hole_pair  = 10;
hole_single= 8;
bridge_t   = 3.2;
leg_t      = 7;      // front leg, thick enough for the pinch insert
leg_h      = 22;
anchor_len = 40;
rest_len   = 14;
rest_deep  = 14;     // how far the rest reaches under the chain
insert_d = 4.2; insert_len = 5.7;
$fn = 48; eps = 0.01;

slot   = lip_t + slot_fit;
z_ch0  = -lip_h + chain_up;          // chain lower edge
z_chc  = z_ch0 + chain_w/2;

module profile(rest = false) {       // in (Y, Z)
  translate([-anchor_t, z_ch0 - 3]) square([anchor_t, -z_ch0 + 3 + bridge_t]);        // block behind the lip
  translate([-eps, 0.2]) square([slot + leg_t + eps, bridge_t - 0.2]);                // bridge over the top
  translate([slot, -leg_h]) square([leg_t, leg_h + 0.2 + eps]);                       // front leg
  if (rest) translate([-anchor_t - rest_deep, z_ch0 - 3]) square([rest_deep + eps, 2]);   // 1 mm under the chain
}

module pinch(x) { translate([x, slot + leg_t + eps, -12]) rotate([90, 0, 0]) { cylinder(d = insert_d, h = insert_len); cylinder(d = 3.2, h = leg_t + 1); } }

module anchor() {
  difference() {
    translate([-anchor_len/2, 0, 0]) rotate([90, 0, 90]) linear_extrude(anchor_len) profile();
    for (h = [[-4, z_chc - hole_pair/2], [-4, z_chc + hole_pair/2], [-4 + hole_single, z_chc]])
      translate([h[0], -anchor_t - eps, h[1]]) rotate([-90, 0, 0]) { cylinder(d = insert_d, h = insert_len); cylinder(d = 3.2, h = 9.5); }
    for (x = [-12, 12]) pinch(x);
  }
}

module rest() {
  difference() {
    translate([-rest_len/2, 0, 0]) rotate([90, 0, 90]) linear_extrude(rest_len) profile(true);
    pinch(0);
  }
}

mode = "print";   // "print" | "anchor" | "rest"
if (mode == "anchor") anchor();
else if (mode == "rest") rest();
else {            // all on their ends: no supports
  translate([0, 0, anchor_len/2]) rotate([0, 90, 0]) anchor();
  for (i = [0:3]) translate([-70, -60 + i*42, rest_len/2]) rotate([0, 90, 0]) rest();
}
