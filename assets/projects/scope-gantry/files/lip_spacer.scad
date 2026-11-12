// Spacer for the lip bolts: goes under each M3x10 head inside the shelf lip, so the screw
// reaches 5 mm into the extrusion's T-nut instead of bottoming out in the slot.
// Its flat sides sit between the curl and the shelf, which stops it spinning while you start the screw.
t = 3; w = 14; h = 22; n = 8;
$fn = 40;
for (i = [0 : n - 1]) translate([i*(w + 3), 0, 0]) difference() {
  cube([w, h, t]);
  translate([w/2, h/2, -0.1]) cylinder(d = 3.4, h = t + 0.2);
}
