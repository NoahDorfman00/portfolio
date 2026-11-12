// Rod clamp for the bench scope gantry, modeled on the scope's metal mount:
// a closed D-shaped bore with one thumbscrew that pushes the rod against the flat.
// Loosen the thumbscrew, slide the rod for extra reach, tighten again.
// Bolts to the underside of the Y carriage (MGN12H, 20 x 20 mm M3 pattern).
// Hardware: 4x M3x10 (to the carriage), 1x M3x10 + heat-set insert + printed knob (thumbscrew).
//
// Frame: Y = rod axis, Z up. Origin = center of the carriage face.
// The thumbscrew sits opposite the flat, like the metal mount. The block is square on its four
// carriage screws, so turning it 180 degrees swaps which side the flat and the thumbscrew are on.

/* [Rod] */
rod_d         = 20.0;
flat_to_curve = 18.23;
bore_clear    = 0.15;   // diametral. Set from the fit gauge: 0.15 / 0.25 / 0.40
flat_side     = -1;     // which side of the bore the flat is on (-X or +X)

/* [Block] */
len      = 44;          // along the rod
half_w   = 17;          // half width
drop     = 25.5;        // carriage face down to the rod axis (sets head height)
floor_t  = 5;

/* [Carriage screws] */
pat      = 20;          // hole pattern, square
grip     = 7;           // plastic under each screw head: M3x10 then reaches 3 mm into the carriage
m3_clear = 3.4;
head_d   = 6.5;         // access/counterbore for the socket head and hex key

/* [Thumbscrew] */
insert_d   = 4.2;
insert_len = 5.7;

$fn = 96; eps = 0.01;
bd     = rod_d + bore_clear;
height = drop + bd/2 + floor_t;

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
    translate([-half_w, -len/2, -height]) cube([2*half_w, len, height]);
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
    // thumbscrew: opposite the flat, at the rod axis, mid-length
    translate([-flat_side*(half_w + eps), 0, -drop]) rotate([0, flat_side*90, 0]) {
      cylinder(d = insert_d, h = insert_len + eps);
      cylinder(d = m3_clear, h = half_w);
    }
  }
}

// Knob for the thumbscrew: press an M3x10 socket head screw in from the top, add a drop of superglue
module knob() {
  difference() {
    union() {
      cylinder(d = 14, h = 5);
      for (a = [0 : 30 : 359]) rotate(a) translate([7, 0, 0]) cylinder(d = 1.6, h = 5, $fn = 12);
      translate([0, 0, -1.5]) cylinder(d = 7, h = 1.5);       // short neck
    }
    translate([0, 0, 5 - 3.2]) cylinder(d = 5.7, h = 3.2 + eps);   // head pocket
    translate([0, 0, -1.5 - eps]) cylinder(d = 3.3, h = 7);
  }
}

mode = "print";   // "print" | "assembly"
if (mode == "assembly") {
  color("royalblue") clamp();
  color("silver") translate([0, 70, -drop]) rotate([90, 0, 0]) linear_extrude(110) offset(-bore_clear/2) d_profile();
  color("dimgray") translate([-13.5, -22.7, 0]) cube([27, 45.4, 10]);                // Y carriage
  color("cornflowerblue") translate([-flat_side*(half_w + 3), 0, -drop]) rotate([0, -flat_side*90, 0]) knob();
} else {
  // stand it on end: the bore prints as a clean vertical hole, no supports
  translate([0, 0, len/2]) rotate([90, 0, 0]) clamp();
  translate([half_w + 14, -height/2, 1.5]) knob();
}
