// LED ring holder for the scope's lens L (two parts: holder + optional diffuser cap)
// A sleeve that slides up over the lens and is pinned by the lens's own two M3 thumbscrews.
// The 12-LED ring drops in from the top and rests LED-side down on a toothed ledge: the LEDs
// poke through the gaps, the fingers between them carry the board. Wires leave through a slot.
// The diffuser cap is a push fit over the bottom of the sleeve.
//
// Frame: Z up, Z=0 is the bottom end of the lens. X axis runs through the two thumbscrews.

/* [Lens, measured] */
barrel_d     = 43.5;   // lens diameter where the thumbscrews are
screw_z      = 46;     // thumbscrew center above the lens's bottom end
screw_d      = 3.4;    // clearance for M3
above_screw  = 4.5;    // sleeve above the screw center. Reduce if it hits the scope body

/* [Ring, measured] */
ring_od      = 37;
ring_id      = 23;
ring_t       = 3.3;    // back of board to top of LEDs
board_t      = 1.6;    // circuit board alone
leds         = 12;
led_w        = 6.0;    // gap for each LED (5 mm LED + clearance)

/* [Holder] */
fit          = 0.5;    // total clearance on the lens barrel
ring_fit     = 0.6;    // total clearance around the ring
wall         = 2.4;
wire_gap     = 6;      // space between the lens's bottom end and the back of the ring
ledge_in     = 1.6;    // how far the ledge reaches in under the board
led_recess   = 0.3;    // LED tops sit this far inside the holder's bottom face
slot_w       = 6;      // wire slot
slot_up      = 4;      // slot height above the lens's bottom end

/* [Diffuser cap] */
cap_fit      = 0.3;
cap_wall     = 1.2;
cap_grip     = 4;      // overlap on the sleeve
cap_standoff = 5;      // distance from the holder's bottom to the diffuser sheet
sheet_t      = 0.4;    // diffuser thickness: two 0.2 mm layers of white PLA
view_d       = 23;     // hole in the middle so the lens looks through air, not plastic

$fn = 120; eps = 0.01;

sleeve_id = barrel_d + fit;
sleeve_od = sleeve_id + 2*wall;
pocket_d  = ring_od + ring_fit;
z_back    = -wire_gap;                     // back of the ring
z_board   = z_back - board_t;              // LED side of the board = top of the ledge
z_bottom  = z_back - ring_t - led_recess;  // bottom face of the holder
z_top     = screw_z + above_screw;

module holder() {
  difference() {
    translate([0, 0, z_bottom]) cylinder(d = sleeve_od, h = z_top - z_bottom);
    // lens bore, down to the back of the ring
    translate([0, 0, z_back]) cylinder(d = sleeve_id, h = z_top - z_back + eps);
    // ring pocket, down to the ledge
    translate([0, 0, z_board]) cylinder(d = pocket_d, h = z_back - z_board + eps);
    // opening through the ledge, and a gap for each LED
    translate([0, 0, z_bottom - eps]) cylinder(d = pocket_d - 2*ledge_in, h = z_board - z_bottom + 2*eps);
    for (i = [0 : leds - 1]) rotate(i*360/leds)
      translate([ring_id/2 - 1, -led_w/2, z_bottom - eps]) cube([(pocket_d - ring_id)/2 + 0.6, led_w, z_board - z_bottom + 2*eps]);
    // thumbscrew holes
    translate([0, 0, screw_z]) rotate([0, 90, 0]) cylinder(d = screw_d, h = sleeve_od + 2, center = true, $fn = 32);
    // wire slot, a quarter turn from the screws
    translate([-slot_w/2, 0, z_back]) cube([slot_w, sleeve_od, slot_up - z_back]);
  }
}

module diffuser() {
  cap_id = sleeve_od + cap_fit;
  cap_od = cap_id + 2*cap_wall;
  stop_id = sleeve_od - 2*wall - 1;        // inner step the sleeve's bottom face sits on
  difference() {
    cylinder(d = cap_od, h = sheet_t + cap_standoff + cap_grip);
    translate([0, 0, sheet_t]) cylinder(d = stop_id, h = cap_standoff + eps);
    translate([0, 0, sheet_t + cap_standoff]) cylinder(d = cap_id, h = cap_grip + eps);
    translate([0, 0, -eps]) cylinder(d = view_d, h = sheet_t + 2*eps);
  }
}

mode = "print";   // "print" (both) | "holder" | "diffuser" | "assembly"
if (mode == "assembly") {
  color("royalblue") difference() { holder(); translate([0, -100, -50]) cube([100, 100, 150]); }
  color("white", 0.8) translate([0, 0, z_bottom - cap_standoff - sheet_t]) difference() { diffuser(); translate([0, -100, -1]) cube([100, 100, 30]); }
  color("dimgray") hull() { translate([0, 0, 30]) cylinder(d = barrel_d, h = 30); cylinder(d = 39, h = 1); }   // lens
  color("darkgreen") translate([0, 0, z_board]) difference() { cylinder(d = ring_od, h = board_t); translate([0, 0, -1]) cylinder(d = ring_id, h = 5); }
  color("white") for (i = [0 : leds - 1]) rotate(i*360/leds) translate([12.5, -2.5, z_board - (ring_t - board_t)]) cube([5, 5, ring_t - board_t]);
} else if (mode == "holder") {
  translate([0, 0, -z_bottom]) holder();
} else if (mode == "diffuser") {
  diffuser();
} else {
  translate([0, 0, -z_bottom]) holder();
  translate([sleeve_od + 8, 0, 0]) diffuser();
}
