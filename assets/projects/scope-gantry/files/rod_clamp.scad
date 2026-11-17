// Rod clamp for the bench scope gantry, modeled on the scope's metal mount:
// a closed D-shaped bore with one thumbscrew that pushes the rod against the flat.
// Loosen the thumbscrew, slide the rod for extra reach, tighten again.
// Bolts to the underside of the Y carriage (MGN12H, 20 x 20 mm M3 pattern).
// Hardware: 4x M3x10 (to the carriage), 1x M3x10 + heat-set insert as the lock screw (printed knob optional).
//
// Frame: Y = rod axis, Z up. Origin = center of the carriage face.
// The lock screw presses on the rod's round side, opposite the flat. The block is square on its four carriage screws, so
// turning it 180 degrees swaps which side the flat and the thumbscrew are on.

/* [Rod] */
rod_d         = 20.0;
flat_to_curve = 18.23;
bore_clear    = 0.25;   // diametral. Fit gauge ring 2 (ring 1 = 0.15, ring 3 = 0.40)
flat_side     = 1;      // which side of the bore the flat is on (-X or +X)
screw_on_flat = false;  // true: thumbscrew presses the flat. false: it presses the round side, opposite the flat

/* [Block] */
len      = 44;          // along the rod
half_w   = 17;          // half width
drop     = 25.5;        // carriage face down to the rod axis (sets head height)
floor_t  = 5;

/* [Zip-tie flange] */
tie_flange = true;      // a ledge along the top edge, on the side away from the lock screw, with two tie slots
tie_w      = 8;         // how far it sticks out
tie_t      = 3.5;
tie_y      = [-13, 13]; // slot positions along the rod
tie_slot   = [2, 4.5];  // slot size: across, along

/* [Carriage screws] */
pat      = 20;          // hole pattern, square
grip     = 7;           // plastic under each screw head: M3x10 then reaches 3 mm into the carriage
m3_clear = 3.4;
head_d   = 6.5;         // access/counterbore for the socket head and hex key

/* [Thumbscrew] */
insert_d   = 4.2;
insert_len = 5.7;
use_knob   = false;     // false: a bare M3x10 socket head screw is the thumbscrew
knob_d     = 14;
knob_h     = 9;
knob_floor = 0.8;       // plastic under the screw head: leaves 9.2 mm of thread below the knob

$fn = 96; eps = 0.01;
bd     = rod_d + bore_clear;
height = drop + bd/2 + floor_t;
flat_r = flat_to_curve - rod_d/2 + bore_clear/2;          // bore center to the flat
screw_side = screw_on_flat ? flat_side : -flat_side;
wall_at_screw = half_w - (screw_on_flat ? flat_r : bd/2);
recess = use_knob ? max(0, wall_at_screw - insert_len) : 0;   // a knob has to sink in for an M3x10 to reach the rod; a bare screw doesn't

module d_profile() {
  flat = flat_to_curve - rod_d/2 + bore_clear/2;     // center to flat
  intersection() {
    circle(d = bd);
    if (flat_side < 0) translate([-flat, -bd]) square([2*bd, 2*bd]);
    else               translate([flat - 2*bd, -bd]) square([2*bd, 2*bd]);
  }
}

module clamp() {
  difference() {
    union() {
      translate([-half_w, -len/2, -height]) cube([2*half_w, len, height]);
      if (tie_flange) translate([-screw_side > 0 ? half_w - eps : -half_w - tie_w, -len/2, -tie_t]) cube([tie_w + eps, len, tie_t]);
    }
    if (tie_flange) for (y = tie_y) translate([-screw_side*(half_w + 3) - tie_slot[0]/2, y - tie_slot[1]/2, -tie_t - eps]) cube([tie_slot[0], tie_slot[1], tie_t + 2*eps]);
    // D bore along Y
    translate([0, len/2 + eps, -drop]) rotate([90, 0, 0]) linear_extrude(len + 2*eps) d_profile();
    // lead-in chamfers
    for (s = [-1, 1]) translate([0, s*(len/2 + eps), -drop]) rotate([s > 0 ? 90 : -90, 0, 0])
      cylinder(d1 = bd + 1.6, d2 = bd - 0.2, h = 0.9);
    // carriage screws: clearance near the top, hex-key access from below (through the bore)
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx*pat/2, sy*pat/2, 0]) {
      translate([0, 0, -grip - eps]) cylinder(d = m3_clear, h = grip + 2*eps);
      translate([0, 0, -height - eps]) cylinder(d = head_d, h = height - grip + eps);
    }
    // thumbscrew at the rod axis, mid-length: recess for the knob, insert, clearance through to the bore
    translate([screw_side*(half_w + eps), 0, -drop]) rotate([0, -screw_side*90, 0]) {
      cylinder(d = knob_d + 3.5, h = recess + eps);
      cylinder(d = insert_d, h = recess + insert_len + eps);
      cylinder(d = m3_clear, h = half_w);
    }
  }
}

// Knob for the thumbscrew: drop an M3x10 socket head screw into the pocket (head at the bottom),
// add a drop of superglue around the head. The hex key reaches it down the pocket.
module knob() {
  difference() {
    union() {
      cylinder(d = knob_d, h = knob_h);
      for (a = [0 : 30 : 359]) rotate(a) translate([knob_d/2, 0, 0]) cylinder(d = 1.6, h = knob_h, $fn = 12);
    }
    translate([0, 0, knob_floor]) cylinder(d = 5.8, h = knob_h);
    translate([0, 0, -eps]) cylinder(d = 3.3, h = knob_floor + 2*eps);
  }
}

mode = "print";   // "print" | "assembly"
if (mode == "assembly") {
  color("royalblue") clamp();
  color("silver") translate([0, 70, -drop]) rotate([90, 0, 0]) linear_extrude(110) offset(-bore_clear/2) d_profile();
  color("dimgray") translate([-13.5, -22.7, 0]) cube([27, 45.4, 10]);                // Y carriage
  if (use_knob) color("cornflowerblue") translate([screw_side*(half_w - recess + knob_h + 1), 0, -drop]) rotate([0, -screw_side*90, 0]) knob();
} else {
  // stand it on end: the bore prints as a clean vertical hole, no supports
  translate([0, 0, len/2]) rotate([90, 0, 0]) clamp();
  if (use_knob) translate([half_w + 14, -height/2, 0]) knob();
}
