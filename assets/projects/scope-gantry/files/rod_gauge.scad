// Fit gauge for the scope's D-keyed rod (20 mm round, 18.23 mm flat-to-curve)
// Three bores marked by notches: 1 = tightest (0.15 mm), 2 = 0.25 mm, 3 = loosest (0.40 mm).
// Tell me which one slides
// smoothly with no rotation slop and I'll use that clearance in the rod clamp.
rod_d    = 20.0;
flat_to_curve = 18.23;
clears   = [0.15, 0.25, 0.40];   // diametral clearance per bore
t        = 8;
od       = 30;
$fn = 96; eps = 0.01;

module d_bore(c) {
  intersection() {
    circle(d = rod_d + c);
    translate([-(rod_d + c)/2 - 1, -(rod_d + c)/2 - 1]) square([rod_d + c + 2, (flat_to_curve - rod_d/2 + c/2) + (rod_d + c)/2 + 1]);
  }
}
for (i = [0 : len(clears) - 1]) translate([i*(od - 2), 0, 0]) difference() {
  cylinder(d = od, h = t);
  translate([0, 0, -eps]) linear_extrude(t + 2*eps) d_bore(clears[i]);
  for (n = [0 : i]) translate([-3*i/2 + 3*n - 0.6, -od/2 - eps, t - 1.2]) cube([1.2, 2.2, 1.2 + eps]);
}
