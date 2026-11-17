// Back slider cap with a cable-chain arm. Replaces the plain cap from back_slider.scad (same four M3x10
// into the body's inserts, same UHMW tape pockets). The arm reaches back behind the rail and stands up
// as a mounting face; the chain's moving end tab bolts flat onto the front of that face with 3x M3x10
// into heat-set inserts. The chain lies on its side, between this face and the shelf's back lip.
//
// Frame as back_slider.scad: X along the back rail, Y toward you, Z up. Z=0 is the cap's underside.
// HANDEDNESS: with Y toward you and Z up, +X points to your LEFT as you face the bench. So the mounting
// face sits to the RIGHT of the slider and the chain's U opens to the LEFT.

/* [From back_slider.scad, keep in step] */
len = 50; rail = 20; side_float = 1.0; wall_t = 7; cap_t = 4.5;
tape_t = 0.25; pad_proud = 0.10; strip_w = 6.5; strip_y = 6.75;
m3_clear = 3.4; cap_screw_x = 17;
slide_slack = 0.15;

/* [Chain] */
lip_back_y   = 25;     // shelf's back lip, rear face, forward of the back rail centre (35 from the rail's rear face)
anchor_t     = 13;     // how far the anchor holds the chain's fixed run off the lip
u_outside    = 60;     // chain folded into a U, measured across the outside
chain_w      = 22;     // link width (vertical here, the chain is on its side)
chain_bot    = 24;     // chain's lower edge above the back rail centre (2 mm above the shelf top)
tab_x        = -55;    // the tab's pair of holes; offset from the slider so the U clears the upright at the far end of travel
hole_pair    = 10;     // two holes, this far apart across the link
hole_single  = 8;      // third hole, this far toward the chain
face_t       = 9;
face_x0      = -70;    // outer end of the mounting face
tie_x        = [-62, -34, 14];   // zip-tie points along the arm, to hold the lead where it leaves the chain

insert_d = 4.2; insert_len = 5.7;
$fn = 48; eps = 0.01;

inner_h = rail + 2*pad_proud + slide_slack;
z_cap   = inner_h/2;                         // cap underside above the rail centre
wall_y1 = rail/2 + side_float + wall_t;
pocket  = tape_t - pad_proud;
face_y  = lip_back_y - anchor_t - u_outside; // front of the mounting face
face_top= chain_bot + chain_w + 1 - z_cap;
hole_z  = chain_bot + chain_w/2 - z_cap;

module chain_cap() {
  difference() {
    union() {
      translate([-len/2, -wall_y1, 0]) cube([len, 2*wall_y1, cap_t]);                               // the cap itself
      translate([face_x0, face_y - face_t, 0]) cube([len/2 - face_x0, -wall_y1 - face_y + face_t + eps, cap_t]);   // arm
      translate([face_x0, face_y - face_t, 0]) cube([len/2 - face_x0, face_t, face_top]);          // mounting face
      translate([face_x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(len/2 - face_x0)               // fillet in the corner
        polygon([[face_y - eps, cap_t - eps], [face_y + 8, cap_t - eps], [face_y - eps, cap_t + 8]]);
    }
    for (s = [-1, 1]) translate([-len/2 - eps, s*strip_y - strip_w/2, -eps]) cube([len + 2*eps, strip_w, pocket + eps]);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx*cap_screw_x, sy*(rail/2 + side_float + wall_t/2), -eps]) cylinder(d = m3_clear, h = cap_t + 2*eps);
    // zip-tie points on the arm, behind the slider: a pair of slots each, the tie loops under the plate
    for (x = tie_x, y = [-wall_y1 - 5, -wall_y1 - 15]) translate([x - 2.25, y - 1, -eps]) cube([4.5, 2, cap_t + 2*eps]);
    for (h = [[tab_x, hole_z - hole_pair/2], [tab_x, hole_z + hole_pair/2], [tab_x + hole_single, hole_z]])
      translate([h[0], face_y + eps, h[1]]) rotate([90, 0, 0]) { cylinder(d = insert_d, h = insert_len); cylinder(d = 3.2, h = face_t + 1); }
  }
}

mode = "print";   // "print" | "part"
if (mode == "print") translate([0, 0, len/2]) rotate([0, 90, 0]) chain_cap();   // on its end: no supports, strong across the corner
else chain_cap();
