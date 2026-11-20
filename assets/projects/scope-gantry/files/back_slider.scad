// Back slider v3 for the bench scope gantry (body here; its cap is chain_cap.scad)
// Changes from v2:
//  - front/back play on the back rail is 3 mm each side (was 1): the front rail and the rigid
//    carriage bracket keep the boom square, this part only carries the boom's back end
//  - it HANGS on the rail by the cap's two UHMW strips. The floor is only an anti-lift guard,
//    0.6 mm clear of the rail, no tape needed
//  - saddle screw holes are vertical slots and the saddle's top is 2 mm clear of the boom, so the
//    boom's back end finds its own height before the four screws are tightened
//  - two bumpers under the floor stop the Y carriage at the rear end of its rail
//  - prints UPSIDE DOWN (wall tops and saddle top on the bed), no supports; the floor is a bridge
// Hardware: 4x M3x10 + T-nuts (saddle to boom sides), 4 heat-set inserts for the cap's M3x10.
//
// Frame: X along the back rail, Y toward you (along the boom), Z up. Origin = back rail center.

/* [Rail fit] */
rail        = 20;
side_float  = 3.0;    // play front/back, each side
pad_proud   = 0.10;   // cap tape stands this far below the cap
lift_gap    = 0.6;    // rail underside to floor

/* [Body] */
len         = 50;
floor_t     = 4.0;
wall_t      = 7;

/* [Boom saddle] */
boom        = 20;
boom_drop   = 5;      // nominal: boom center below back rail center
boom_fit    = 0.4;
cheek_t     = 5;
saddle_len  = 40;
boom_gap    = 1;
screw_y     = [12, 30];
v_adj       = 2;      // boom height adjustment, +/-
rail_relief = 2;      // groove under the floor so the Y rail's overhang can rise with the boom
yrail_w     = 12;

/* [Y carriage stop] */
stop_y      = 4;      // stop face, forward of the back rail center. The carriage's rear face lands here
stop_len    = 16;
stop_x      = [7.5, 20];   // each side of the Y rail; the MGN12H block is 13.5 either side of center
stop_bot    = -30;    // carriage block spans about -18 .. -28

/* [Hardware] */
m3_clear    = 3.4;
insert_d    = 4.2;
insert_len  = 5.5;
cap_screw_x = 17;

$fn = 48; eps = 0.01;

z_top    = rail/2 + pad_proud;      // wall top = cap underside
z_floor  = -rail/2 - lift_gap;
z_bot    = z_floor - floor_t;
wall_y0  = rail/2 + side_float;
wall_y1  = wall_y0 + wall_t;
wall_yc  = wall_y0 + wall_t/2;
boom_zc  = -boom_drop;
boom_top = boom_zc + boom/2;
cheek_x0 = boom/2 + boom_fit/2;

module body() {
  difference() {
    union() {
      translate([-len/2, -wall_y1, z_bot]) cube([len, 2*wall_y1, floor_t]);
      for (s = [-1, 1]) translate([-len/2, s > 0 ? wall_y0 : -wall_y1, z_bot]) cube([len, wall_t, z_top - z_bot]);
      for (s = [-1, 1]) translate([s > 0 ? cheek_x0 : -cheek_x0 - cheek_t, wall_y1 - eps, z_bot])
        cube([cheek_t, saddle_len + eps, z_top - z_bot]);
      translate([-cheek_x0 - cheek_t, wall_y1 - eps, boom_top + v_adj]) cube([2*(cheek_x0 + cheek_t), saddle_len + eps, z_top - boom_top - v_adj]);
      // Y carriage bumpers
      for (s = [-1, 1]) translate([s > 0 ? stop_x[0] : -stop_x[1], stop_y - stop_len, stop_bot]) cube([stop_x[1] - stop_x[0], stop_len, z_bot - stop_bot + eps]);
    }
    // groove for the Y rail's overhang
    translate([-yrail_w/2 - 1.5, stop_y - stop_len - 2, z_bot - eps]) cube([yrail_w + 3, wall_y1 - stop_y + stop_len + 3, rail_relief + eps]);
    // saddle screws: vertical slots
    for (s = [-1, 1], y = screw_y) hull() for (dz = [-v_adj, v_adj])
      translate([s*(cheek_x0 - eps), wall_y1 + boom_gap + y, boom_zc + dz]) rotate([0, s*90, 0]) cylinder(d = m3_clear, h = cheek_t + 2*eps);
    for (sx = [-1, 1], sy = [-1, 1]) translate([sx*cap_screw_x, sy*wall_yc, z_top - insert_len]) cylinder(d = insert_d, h = insert_len + eps);
  }
}

mode = "print";   // "print" | "assembly"
if (mode == "assembly") {
  color("royalblue") body();
  color("silver", 0.6) translate([-70, -rail/2, -rail/2]) cube([140, rail, rail]);
  color("lightgray") translate([-boom/2, wall_y1 + boom_gap, boom_zc - boom/2]) cube([boom, 110, boom]);
  color("dimgray") translate([-6, 0, boom_zc - boom/2 - 8]) cube([12, 130, 8]);
  color("orange") translate([-13.5, stop_y, boom_zc - boom/2 - 13]) cube([27, 45.4, 10]);   // Y carriage at the stop
} else translate([0, 0, z_top]) rotate([180, 0, 0]) body();
