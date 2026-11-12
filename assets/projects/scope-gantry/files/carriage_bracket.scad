// Carriage bracket for the bench scope gantry
// Joins the X carriage (on the front of the shelf lip) to the boom (behind the lip, under the shelf).
// It drops from the carriage, passes under the lip's curl, rises behind it, and ends in a plate
// that sits on top of the boom.
// Hardware: 4x M3x10 (front plate to the MGN12H carriage), 2x M3x10 + T-nuts (top plate to boom).
// Assembly order: bolt the boom to the top plate on the bench (those two screws can't be reached
// once it's under the shelf), then hang the assembly on the carriage with the four front screws.
//
// Frame: X along the shelf, Y toward you, Z up.
// Origin: outer surface of the lip's front face (Y=0), bottom of the lip (Z=0).

/* [Shelf lip, measured] */
curl_depth  = 20;
shelf_under = 26;     // underside of the shelf above the lip bottom

/* [X axis stack on the lip face] */
ext         = 20;     // backer extrusion, bolted straight to the lip face
ext_z0      = 4;      // its bottom edge above the lip bottom (holes drilled 14 mm up)
stack       = 13;     // MGN12H: rail seat to carriage top
car_w       = 27;     // carriage width (vertical here)
pat         = 20;     // carriage hole pattern

/* [Bracket] */
width       = 56;
plate_t     = 7;      // front plate: M3x10 reaches 3 mm into the carriage
curl_clear  = 1.5;    // strap clearance under the lip
strap_bot   = -17;    // underside of the strap. The head passes 2.5 mm below this
riser_gap   = 2;      // riser clearance behind the curl's edge
riser_t     = 8;

/* [Boom] */
boom        = 20;
boom_top    = 11;     // boom top face height. Matches the back slider (boom center 5 below back rail center)
top_t       = 6;
top_len     = 48;     // overlap on the boom
boom_screws = [15, 38];   // from the boom's front end
key_w       = 5.8;    // key into the boom's top slot
key_h       = 1.4;

/* [Hardware] */
m3_clear    = 3.4;
head_d      = 6.4;
head_cb     = 1.5;    // counterbore in the top plate: leaves 4.5 mm under the head

$fn = 48; eps = 0.01;

y_face   = ext + stack;               // carriage mounting face
car_zc   = ext_z0 + ext/2;
y_riser1 = -curl_depth - riser_gap;   // riser front
y_riser0 = y_riser1 - riser_t;        // riser back = boom front end
strap_top = -curl_clear;

module profile() {
  polygon([
    [y_face, car_zc + car_w/2], [y_face + plate_t, car_zc + car_w/2], [y_face + plate_t, strap_bot],
    [y_riser0, strap_bot], [y_riser0, boom_top], [y_riser0 - top_len, boom_top],
    [y_riser0 - top_len, boom_top + top_t], [y_riser1, boom_top + top_t], [y_riser1, strap_top],
    [y_face, strap_top]
  ]);
}

module bracket() {
  difference() {
    union() {
      rotate([90, 0, 90]) translate([0, 0, -width/2]) linear_extrude(width) profile();
      // key into the boom's top slot, chamfered so it prints without support on its side
      hull() {
        translate([-key_w/2, y_riser0 - top_len, boom_top - eps]) cube([key_w, top_len - 1, eps]);
        translate([-key_w/2 + key_h, y_riser0 - top_len, boom_top - key_h]) cube([key_w - 2*key_h + 0.6, top_len - 1, eps]);
      }
    }
    // carriage screws, heads on the front
    for (sx = [-1, 1], sz = [-1, 1]) translate([sx*pat/2, y_face - eps, car_zc + sz*pat/2]) rotate([-90, 0, 0])
      cylinder(d = m3_clear, h = plate_t + 2*eps);
    // boom screws through the top plate
    for (d = boom_screws) translate([0, y_riser0 - d, boom_top - key_h - eps]) {
      cylinder(d = m3_clear, h = top_t + key_h + 2*eps);
      translate([0, 0, key_h + top_t - head_cb]) cylinder(d = head_d, h = head_cb + 2*eps);
    }
  }
}

// ---------- reference geometry (previews only) ----------
module refs() {
  color("gray", 0.5) {
    translate([-45, -2, 0]) cube([90, 2, 28]);
    translate([-45, -curl_depth, 0]) cube([90, curl_depth, 2]);
    translate([-45, -150, shelf_under]) cube([90, 150, 2]);
  }
  color("silver") translate([-45, 0, ext_z0]) cube([90, ext, ext]);
  color("dimgray") translate([-45, ext, car_zc - 6]) cube([90, 8, 12]);
  color("dimgray") translate([-22.7, ext + 3, car_zc - car_w/2]) cube([45.4, stack - 3, car_w]);
  color("lightgray") translate([-boom/2, y_riser0 - 150, boom_top - boom]) cube([boom, 150, boom]);
  color("dimgray") translate([-6, y_riser0 - 150, boom_top - boom - 8]) cube([12, 150, 8]);
}

mode = "print";   // "print" | "assembly"
if (mode == "assembly") { color("royalblue") bracket(); refs(); }
else rotate([0, -90, 0]) translate([width/2, 0, 0]) bracket();   // on its side, no supports
