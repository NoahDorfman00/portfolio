// Back rail collar for the bench scope gantry (print one of each hand)
// An open sleeve that slips over the end of the back rail, flush with the end, so the rail still
// seats directly on the gusset. A tall wing wraps onto the upright's BACK face and stops the rail
// rotating around its single 1/4-20 bolt. One M3x10 + T-nut through the top pins it to the rail.
//
// Frame: X along the rail (X=0 is the rail's end, +X is into the upright), Y toward you, Z up.
// Origin: rail centerline = bolt centerline.

/* [Measure these] */
bolt_to_back = 25;    // bolt center to the upright's back face, measured
gusset_t     = 2.5;   // thickness of the gusset between the rail end and the upright, measured

/* [Collar] */
rail        = 20;
fit         = 0.3;    // total clearance on the rail
wall        = 5;      // 5 mm top wall: M3x10 reaches 5 mm into the T-nut
collar_len  = 15;

/* [Wing] */
wing_t      = 5;
wing_half_h = 25;     // above and below the bolt
wrap        = 22;     // how far the wing runs along the upright's back face
back_clear  = 0.3;    // gap between wing and upright

m3_clear = 3.4;
$fn = 48; eps = 0.01;

inner  = rail + fit;
c_half = inner/2 + wall;
y_wing1 = -(bolt_to_back + back_clear);   // wing face that touches the upright
y_wing0 = y_wing1 - wing_t;

module collar(hand = 1) {
  mirror([hand < 0 ? 1 : 0, 0, 0]) difference() {
    union() {
      translate([-collar_len, -c_half, -c_half]) cube([collar_len, 2*c_half, 2*c_half]);                 // sleeve
      translate([-collar_len, y_wing0, -wing_half_h]) cube([collar_len, -c_half - y_wing0 + eps, 2*wing_half_h]);   // web behind the sleeve
      translate([-collar_len, y_wing0, -wing_half_h]) cube([collar_len + gusset_t + wrap, wing_t, 2*wing_half_h]);  // wing
    }
    translate([-collar_len - eps, -inner/2, -inner/2]) cube([collar_len + 2*eps, inner, inner]);          // rail
    translate([-collar_len/2, 0, inner/2 - eps]) cylinder(d = m3_clear, h = wall + 2*eps);                // T-nut screw, top
  }
}

mode = "print";   // "print" | "assembly"
if (mode == "assembly") {
  color("royalblue") collar();
  color("silver") translate([-120, -rail/2, -rail/2]) cube([120, rail, rail]);
  color("gray", 0.6) translate([0, -bolt_to_back, -60]) cube([gusset_t, bolt_to_back + 60, 80]);        // gusset
  color("dimgray", 0.6) translate([gusset_t, -bolt_to_back, -120]) cube([40, 48, 200]);                 // upright
} else {
  // sleeve end down, wing rising: no supports
  for (h = [1, -1]) translate([h*40, 0, 0]) rotate([0, h*-90, 0]) translate([h*collar_len, 0, 0]) collar(h);
}
