// X rail end stop, v2: clamps anywhere along the backer extrusion's TOP slot with one M3x10 + T-nut.
// No tapped end hole, no bumper screw. A leg hangs down in front of the rail and the edge of the
// carriage bracket's front plate runs into it, about 5 mm before the carriage itself would.
// One part serves both ends. Prints on its side (as loaded), no supports.
//
// Profile frame: U toward you (U=0 extrusion back face), V up (V=0 extrusion bottom). Extruded along the rail.

ext = 20; rail_h = 8; rail_w = 12; stack = 13; plate_t = 7;
len = 20;          // along the rail
top_t = 7;         // block on top of the extrusion
u0 = 1;            // clear of the lip / spacers behind
rail_gap = 0.7;    // around the rail
leg_bot = 3;       // leg reaches this far down (V)
screw_u = ext/2; m3_clear = 3.4; head_d = 6.4; head_cb = 2.5;
key_w = 5.8; key_h = 0;   // no key: it bottomed on the T-nut before the block clamped
$fn = 48; eps = 0.01;

u_max = ext + stack + plate_t;          // flush with the bracket's front face
rail_top = ext/2 + rail_w/2;

module profile() polygon([
  [u0, ext], [ext + 0.15, ext], [ext + 0.15, rail_top + rail_gap], [ext + rail_h + rail_gap, rail_top + rail_gap],
  [ext + rail_h + rail_gap, leg_bot], [u_max, leg_bot], [u_max, ext + top_t], [u0, ext + top_t]]);

module stop() difference() {
  linear_extrude(len) profile();
  translate([screw_u, ext - key_h - eps, len/2]) rotate([-90, 0, 0]) {
    cylinder(d = m3_clear, h = top_t + key_h + 2*eps);
    translate([0, 0, key_h + top_t - head_cb]) cylinder(d = head_d, h = head_cb + 2*eps);
  }
}

mode = "print";
if (mode == "assembly") {
  color("orange") rotate([90, 0, 90]) stop();
  color("silver") translate([-60, 0, 0]) cube([100, ext, ext]);
  color("dimgray") translate([-60, ext, ext/2 - 6]) cube([100, 8, 12]);
  color("gray") translate([-60 , ext + 3, ext/2 - 13.5]) cube([45.4, 10, 27]);
  color("royalblue", 0.7) translate([-65.3, ext + stack, -21]) cube([56, plate_t, 44.5]);
} else for (i = [0, 1]) translate([i*48, 0, 0]) stop();
