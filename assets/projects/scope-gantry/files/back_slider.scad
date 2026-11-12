// Back slider v2 for the bench scope gantry (two parts: body + cap)
// The back rail (2020 T-slot) is bolted between the uprights, level with the boom, so the boom
// stops just in front of it. The body wraps the rail and a saddle on its front grips the boom's
// rear end from above (boom drops in from below; the Y rail on the boom's underside stays clear).
// UHMW tape strips (10 mil, cut ~6 mm wide) line the floor and cap on the flats either side of
// the rail's T-slot. Front/back there is deliberate play so the slider can't fight the front rail.
// Hardware: 4x M3x10 + T-nuts (saddle to boom sides), 4x M3x10 + 4 heat-set inserts (cap).
//
// Frame: X along the back rail, Y toward you (along the boom), Z up. Origin = back rail center.

/* [Rail fit] */
rail        = 20;
side_float  = 1.0;    // play front/back, each side
tape_t      = 0.25;   // UHMW tape thickness (10 mil)
pad_proud   = 0.10;   // how far the tape stands above the plastic
slide_slack = 0.15;   // total vertical running clearance. Raise if too tight, lower if it rattles
strip_w     = 6.5;
strip_y     = 6.75;

/* [Body] */
len         = 50;     // along the back rail
floor_t     = 4.0;    // keep thin: the Y rail's overhang passes just underneath
wall_t      = 7;
cap_t       = 4.5;

/* [Boom saddle] */
boom        = 20;
boom_drop   = 5;      // boom center sits this far below the back rail center
boom_fit    = 0.4;    // total side clearance on the boom
cheek_t     = 5;      // sets M3x10 engagement into the boom's side T-nuts
saddle_len  = 40;     // along the boom
saddle_top  = 4;
boom_gap    = 1;      // boom end to slider wall
screw_y     = [12, 30];   // screw positions along the saddle

/* [Hardware] */
m3_clear    = 3.4;
insert_d    = 4.2;
insert_len  = 5.5;
cap_screw_x = 17;

$fn = 48; eps = 0.01;

inner_w  = rail + 2*side_float;
inner_h  = rail + 2*pad_proud + slide_slack;
pocket   = tape_t - pad_proud;
z_floor  = -inner_h/2;              // floor top
z_bot    = z_floor - floor_t;       // underside of the part
z_top    = inner_h/2;               // wall top
wall_y0  = inner_w/2;
wall_y1  = wall_y0 + wall_t;
wall_yc  = wall_y0 + wall_t/2;
boom_zc  = -boom_drop;
boom_top = boom_zc + boom/2;
cheek_x0 = boom/2 + boom_fit/2;

module strips(z) {
  for (s = [-1, 1]) translate([-len/2 - eps, s*strip_y - strip_w/2, z]) cube([len + 2*eps, strip_w, pocket + eps]);
}

module body() {
  difference() {
    union() {
      translate([-len/2, -wall_y1, z_bot]) cube([len, 2*wall_y1, floor_t]);                       // floor
      for (s = [-1, 1]) translate([-len/2, s > 0 ? wall_y0 : -wall_y1, z_bot]) cube([len, wall_t, z_top - z_bot]);  // walls
      // saddle: two cheeks and a top tie, in front of the front wall
      for (s = [-1, 1]) translate([s > 0 ? cheek_x0 : -cheek_x0 - cheek_t, wall_y1 - eps, z_bot])
        cube([cheek_t, saddle_len + eps, boom_top - z_bot]);
      translate([-cheek_x0 - cheek_t, wall_y1 - eps, boom_top]) cube([2*(cheek_x0 + cheek_t), saddle_len + eps, saddle_top]);
    }
    strips(z_floor - pocket);
    // saddle screws into T-nuts in the boom's side slots
    for (s = [-1, 1], y = screw_y) translate([s*(cheek_x0 - eps), wall_y1 + boom_gap + y, boom_zc]) rotate([0, s*90, 0])
      cylinder(d = m3_clear, h = cheek_t + 2*eps);
    // inserts for the cap
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx*cap_screw_x, sy*wall_yc, z_top - insert_len]) cylinder(d = insert_d, h = insert_len + eps);
  }
}

module cap() {
  difference() {
    translate([-len/2, -wall_y1, 0]) cube([len, 2*wall_y1, cap_t]);
    strips(-eps);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx*cap_screw_x, sy*wall_yc, -eps]) cylinder(d = m3_clear, h = cap_t + 2*eps);
  }
}

mode = "print";   // "print" | "assembly"
if (mode == "assembly") {
  color("royalblue") body();
  color("cornflowerblue") translate([0, 0, z_top]) cap();
  color("silver") translate([-70, -rail/2, -rail/2]) cube([140, rail, rail]);                                  // back rail
  color("lightgray") translate([-boom/2, wall_y1 + boom_gap, boom_zc - boom/2]) cube([boom, 110, boom]);       // boom
  color("dimgray") translate([-6, -40, boom_zc - boom/2 - 8]) cube([12, 170, 8]);                              // Y rail overhang
} else {
  translate([0, 0, -z_bot]) body();                               // prints as it sits, no supports (short bridge over the boom slot)
  translate([len + 10, 0, cap_t]) rotate([180, 0, 0]) cap();      // cap flipped: pockets face up
}
