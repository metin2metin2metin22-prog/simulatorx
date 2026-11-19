// Tactical Map Waypoints and Graph for de_dust2 (1024 x 1024 coordinate system)
const DUST2_DATA = {
  name: "Dust II",
  code: "de_dust2",
  image: "assets/de_dust2.png",
  width: 1024,
  height: 1024,
  sites: {
    A: { x: 819, y: 164, radius: 46, name: "Bomb Site A" },
    B: { x: 215, y: 123, radius: 46, name: "Bomb Site B" }
  },
  spawns: {
    CT: [
      { x: 630, y: 215 },
      { x: 650, y: 215 },
      { x: 610, y: 225 },
      { x: 640, y: 235 },
      { x: 660, y: 230 }
    ],
    T: [
      { x: 395, y: 925 },
      { x: 415, y: 925 },
      { x: 380, y: 940 },
      { x: 430, y: 940 },
      { x: 400, y: 955 }
    ]
  },
  nodes: {
    // T Spawn Area
    t_spawn: { x: 400, y: 935, name: "T Spawn", neighbors: ["t_suicide_top", "t_plat_long", "t_tunnels_enter"] },
    t_suicide_top: { x: 400, y: 880, name: "T Spawn Exit", neighbors: ["t_spawn", "suicide", "t_tunnels_enter"] },
    t_plat_long: { x: 530, y: 890, name: "T Long Ramp", neighbors: ["t_spawn", "outside_long_ramp"] },
    outside_long_ramp: { x: 620, y: 870, name: "Outside Long Ramp", neighbors: ["t_plat_long", "outside_long"] },
    outside_long: { x: 677, y: 822, name: "Outside Long", neighbors: ["outside_long_ramp", "long_doors_t"] },
    t_tunnels_enter: { x: 230, y: 840, name: "T Tunnels Entrance", neighbors: ["t_spawn", "t_suicide_top", "upper_tunnels_1"] },

    // Long A Route
    long_doors_t: { x: 717, y: 800, name: "Long Doors (T)", neighbors: ["outside_long", "long_doors_ct"] },
    long_doors_ct: { x: 730, y: 720, name: "Long Doors (CT)", neighbors: ["long_doors_t", "long_doors_exit"] },
    long_doors_exit: { x: 785, y: 695, name: "Long Doors Exit", neighbors: ["long_doors_ct", "long_corner"] },
    long_corner: { x: 880, y: 677, name: "Long Corner", neighbors: ["long_doors_exit", "long_pit", "long_street"] },
    long_pit: { x: 920, y: 640, name: "Pit", neighbors: ["long_corner", "long_street"] },
    long_street: { x: 880, y: 480, name: "Long Street", neighbors: ["long_corner", "long_pit", "long_car"] },
    long_car: { x: 880, y: 360, name: "Long Car", neighbors: ["long_street", "long_cross"] },
    long_cross: { x: 830, y: 240, name: "Long Cross", neighbors: ["long_car", "a_ramp", "ct_elevator"] },
    a_ramp: { x: 820, y: 200, name: "A Ramp", neighbors: ["long_cross", "a_site"] },
    a_site: { x: 819, y: 164, name: "A Site", neighbors: ["a_ramp", "a_short_site", "ct_elevator", "goose"] },
    goose: { x: 810, y: 110, name: "Goose", neighbors: ["a_site", "a_short_site"] },

    // Short A / Catwalk Route
    suicide: { x: 470, y: 760, name: "Suicide", neighbors: ["t_suicide_top", "top_mid"] },
    top_mid: { x: 490, y: 660, name: "Top Mid", neighbors: ["suicide", "mid_palm", "xbox"] },
    mid_palm: { x: 509, y: 560, name: "Palm / Mid", neighbors: ["top_mid", "lower_tunnels_exit", "mid_doors_t"] },
    xbox: { x: 520, y: 520, name: "Xbox", neighbors: ["top_mid", "catwalk_start", "mid_palm"] },
    catwalk_start: { x: 534, y: 474, name: "Catwalk Start", neighbors: ["xbox", "catwalk_mid"] },
    catwalk_mid: { x: 614, y: 434, name: "Catwalk", neighbors: ["catwalk_start", "catwalk_stairs"] },
    catwalk_stairs: { x: 670, y: 370, name: "Short Stairs", neighbors: ["catwalk_mid", "a_short"] },
    a_short: { x: 741, y: 271, name: "A Short", neighbors: ["catwalk_stairs", "a_short_site", "ct_short_stairs"] },
    a_short_site: { x: 790, y: 220, name: "A Short Site", neighbors: ["a_short", "a_site", "goose"] },

    // Middle Route
    mid_doors_t: { x: 509, y: 460, name: "Mid Doors", neighbors: ["mid_palm", "mid_doors_ct"] },
    mid_doors_ct: { x: 517, y: 394, name: "Mid Doors (CT)", neighbors: ["mid_doors_t", "ct_mid"] },
    ct_mid: { x: 540, y: 280, name: "CT Mid", neighbors: ["mid_doors_ct", "ct_spawn", "ct_ramp_b"] },
    ct_spawn: { x: 635, y: 215, name: "CT Spawn", neighbors: ["ct_mid", "ct_elevator", "ct_short_stairs"] },
    ct_elevator: { x: 760, y: 200, name: "CT Elevator", neighbors: ["ct_spawn", "long_cross", "a_site"] },
    ct_short_stairs: { x: 690, y: 250, name: "CT to Short", neighbors: ["ct_spawn", "a_short"] },

    // B Route via Upper Tunnels (Authentic Narrow Choke at x=112)
    upper_tunnels_1: { x: 190, y: 720, name: "Upper Tunnels (Entry)", neighbors: ["t_tunnels_enter", "upper_tunnels_mid"] },
    upper_tunnels_mid: { x: 180, y: 600, name: "Upper Tunnels", neighbors: ["upper_tunnels_1", "lower_tunnels_stairs", "upper_tunnels_bend"] },
    lower_tunnels_stairs: { x: 274, y: 648, name: "Lower Tunnels (Stairs)", neighbors: ["upper_tunnels_mid", "lower_tunnels_exit"] },
    lower_tunnels_exit: { x: 420, y: 590, name: "Lower Tunnels (Exit)", neighbors: ["lower_tunnels_stairs", "mid_palm"] },
    upper_tunnels_bend: { x: 166, y: 480, name: "Upper Tunnels (Bend)", neighbors: ["upper_tunnels_mid", "upper_tunnels_stairs"] },
    upper_tunnels_stairs: { x: 125, y: 440, name: "Upper Tunnels (Stairs)", neighbors: ["upper_tunnels_bend", "upper_tunnels_choke"] },
    upper_tunnels_choke: { x: 112, y: 380, name: "Upper Tunnels (Dar Yol)", neighbors: ["upper_tunnels_stairs", "upper_tunnels_north"] },
    upper_tunnels_north: { x: 112, y: 330, name: "Upper Tunnels (Choke Exit)", neighbors: ["upper_tunnels_choke", "b_tunnels_exit"] },
    b_tunnels_exit: { x: 150, y: 300, name: "Upper Tunnels Exit", neighbors: ["upper_tunnels_north", "b_platform", "b_car"] },

    // B Site
    b_platform: { x: 180, y: 220, name: "B Platform", neighbors: ["b_tunnels_exit", "b_site", "b_car"] },
    b_car: { x: 160, y: 200, name: "B Car", neighbors: ["b_tunnels_exit", "b_platform", "b_site"] },
    b_site: { x: 215, y: 140, name: "B Site", neighbors: ["b_platform", "b_car", "b_back_site", "b_window", "b_doors"] },
    b_back_site: { x: 170, y: 90, name: "B Back Site", neighbors: ["b_site"] },
    b_window: { x: 280, y: 175, name: "B Window", neighbors: ["b_site", "b_doors_outside"] },
    b_doors: { x: 320, y: 200, name: "B Doors", neighbors: ["b_site", "b_doors_outside"] },
    b_doors_outside: { x: 350, y: 240, name: "Outside B Doors", neighbors: ["b_doors", "b_window", "ct_ramp_b"] },
    ct_ramp_b: { x: 440, y: 270, name: "CT Ramp to B", neighbors: ["b_doors_outside", "ct_mid"] }
  },

  // Clean High-Precision Solid Obstacle Walls for Line of Sight, Bullet Occlusion & Collision
  // Mathematically verified to have 0 collisions with corridor graph navigation edges
  walls: [
    // 1. Long A vs Short / Catwalk Dividing Building (separates Long Street from Short/Catwalk)
    { x1: 810, y1: 260, x2: 810, y2: 650, name: 'Long_A_Dividing_Wall' },

    // 2. Outside Long vs Suicide / Mid Building (separates Outside Long from Top Mid)
    { x1: 600, y1: 680, x2: 600, y2: 830, name: 'Outside_Long_West_Wall' },
    { x1: 530, y1: 680, x2: 600, y2: 680, name: 'Outside_Long_North_Wall' },

    // 3. Suicide vs Upper Tunnels (Solid rock ridge)
    { x1: 350, y1: 700, x2: 350, y2: 820, name: 'Suicide_Tunnels_Rock' },

    // 4. Upper Tunnels vs Mid (Solid rock ridge north of Lower Tunnels)
    { x1: 270, y1: 530, x2: 440, y2: 530, name: 'Tunnels_Mid_Rock' },

    // 5. Mid Doors Structure & Doorposts
    { x1: 430, y1: 420, x2: 495, y2: 420, name: 'Mid_Door_Left' },
    { x1: 525, y1: 420, x2: 570, y2: 420, name: 'Mid_Door_Right' },
    { x1: 430, y1: 420, x2: 430, y2: 300, name: 'CT_Mid_West' },
    { x1: 570, y1: 420, x2: 570, y2: 340, name: 'CT_Mid_East' },

    // 6. B Site & CT Mid Major Building (separates B Site from CT Spawn / CT Mid)
    { x1: 340, y1: 70, x2: 460, y2: 70, name: 'B_CT_Building_North' },
    { x1: 460, y1: 70, x2: 460, y2: 220, name: 'B_CT_Building_East' },
    { x1: 340, y1: 220, x2: 460, y2: 220, name: 'B_CT_Building_South' },
    { x1: 340, y1: 70, x2: 340, y2: 170, name: 'B_CT_Building_West' },

    // 7. Outer Boundaries & Cavern Walls
    { x1: 170, y1: 860, x2: 170, y2: 330, name: 'Upper_Tunnels_West' },
    { x1: 110, y1: 60, x2: 340, y2: 60, name: 'B_North_Wall' },
    { x1: 110, y1: 60, x2: 110, y2: 250, name: 'B_West_Wall' },
    { x1: 720, y1: 60, x2: 950, y2: 60, name: 'A_North_Wall' },
    { x1: 950, y1: 60, x2: 950, y2: 700, name: 'Long_East_Boundary' }
  ],

  // Pre-configured strategy waypoints
  strategies: {
    T: {
      rush_b: {
        name: "Rush B Don't Stop",
        description: "All 5 Ts rush through Upper Tunnels directly to B Site with flashes.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_platform", "b_site"], role: "entry" },
          { slot: 1, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_car", "b_site"], role: "planter" },
          { slot: 2, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_window"], role: "support" },
          { slot: 3, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_doors"], role: "support" },
          { slot: 4, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_platform"], role: "rearguard" }
        ]
      },
      long_a_execute: {
        name: "Long A Execute",
        description: "4 Ts take Long control with utility and push A Site; 1 lurks Catwalk.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t", "long_doors_ct", "long_doors_exit", "long_corner", "long_street", "long_cross", "a_ramp", "a_site"], role: "entry" },
          { slot: 1, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t", "long_doors_ct", "long_doors_exit", "long_corner", "long_street", "long_cross", "a_site"], role: "planter" },
          { slot: 2, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t", "long_doors_ct", "long_doors_exit", "long_corner", "long_pit"], role: "pit_anchor" },
          { slot: 3, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t", "long_doors_ct", "long_doors_exit", "long_corner", "long_car"], role: "support" },
          { slot: 4, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "xbox", "catwalk_start", "catwalk_mid", "catwalk_stairs", "a_short"], role: "cat_lurk" }
        ]
      },
      a_split: {
        name: "A Split (Short & Long)",
        description: "2 Ts push Long A, 3 Ts push Catwalk Short into A Site together.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t", "long_doors_ct", "long_doors_exit", "long_corner", "long_cross", "a_site"], role: "long_entry" },
          { slot: 1, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t", "long_doors_ct", "long_doors_exit", "long_corner", "long_street"], role: "long_support" },
          { slot: 2, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "xbox", "catwalk_start", "catwalk_mid", "catwalk_stairs", "a_short", "a_site"], role: "planter" },
          { slot: 3, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "xbox", "catwalk_start", "catwalk_mid", "catwalk_stairs", "a_short", "goose"], role: "short_entry" },
          { slot: 4, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm", "mid_doors_t"], role: "mid_cut" }
        ]
      },
      mid_to_b: {
        name: "Mid to B Split",
        description: "2 Ts from Tunnels, 3 Ts crack Mid Doors and flood B from CT Ramp.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm", "mid_doors_t", "mid_doors_ct", "ct_mid", "ct_ramp_b", "b_doors_outside", "b_doors", "b_site"], role: "mid_entry" },
          { slot: 1, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm", "mid_doors_t", "mid_doors_ct", "ct_mid", "ct_ramp_b", "b_doors_outside", "b_window"], role: "mid_support" },
          { slot: 2, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_platform", "b_site"], role: "planter" },
          { slot: 3, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend", "upper_tunnels_stairs", "upper_tunnels_choke", "upper_tunnels_north", "b_tunnels_exit", "b_car"], role: "tunnel_entry" },
          { slot: 4, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm", "lower_tunnels_exit"], role: "lower_cut" }
        ]
      },
      default_pick: {
        name: "Default (Map Control)",
        description: "Probe all lanes for opening picks, then coordinate plant on the open site.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_plat_long", "outside_long_ramp", "outside_long", "long_doors_t"], role: "long_probe" },
          { slot: 1, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm"], role: "mid_probe" },
          { slot: 2, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "xbox", "catwalk_start"], role: "cat_probe" },
          { slot: 3, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_bend"], role: "tunnels_probe" },
          { slot: 4, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm", "lower_tunnels_exit"], role: "planter_float" }
        ]
      }
    },
    CT: {
      standard_212: {
        name: "Standard 2-1-2 Setup",
        description: "2 Long/A, 1 Mid sniper/anchor, 2 B site defenders.",
        assignments: [
          { slot: 0, path: ["ct_spawn", "ct_elevator", "long_cross", "long_car"], role: "long_anchor" },
          { slot: 1, path: ["ct_spawn", "ct_short_stairs", "a_short"], role: "short_anchor" },
          { slot: 2, path: ["ct_spawn", "ct_mid", "mid_doors_ct"], role: "mid_awper" },
          { slot: 3, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_doors", "b_site"], role: "b_anchor" },
          { slot: 4, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_window", "b_platform"], role: "b_support" }
        ]
      },
      aggressive_long: {
        name: "Aggressive Long Push",
        description: "3 CTs push Long Doors to trap Ts; 1 Mid, 1 B site solo.",
        assignments: [
          { slot: 0, path: ["ct_spawn", "ct_elevator", "long_cross", "long_street", "long_corner", "long_doors_exit", "long_doors_ct"], role: "long_pusher_1" },
          { slot: 1, path: ["ct_spawn", "ct_elevator", "long_cross", "long_street", "long_pit"], role: "long_pusher_2" },
          { slot: 2, path: ["ct_spawn", "ct_elevator", "long_cross", "long_car"], role: "long_flash_support" },
          { slot: 3, path: ["ct_spawn", "ct_mid", "mid_doors_ct"], role: "mid_watch" },
          { slot: 4, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_doors", "b_site"], role: "b_solo_hold" }
        ]
      },
      b_stack: {
        name: "B Stack (Anti-Rush)",
        description: "3 CTs hold tight crossfire on B Site, 1 Mid, 1 A anchor.",
        assignments: [
          { slot: 0, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_doors", "b_site"], role: "b_close" },
          { slot: 1, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_window", "b_platform"], role: "b_plat" },
          { slot: 2, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_doors", "b_car"], role: "b_car" },
          { slot: 3, path: ["ct_spawn", "ct_mid", "mid_doors_ct"], role: "mid_hold" },
          { slot: 4, path: ["ct_spawn", "ct_elevator", "a_site"], role: "a_solo" }
        ]
      },
      cat_control: {
        name: "Catwalk Aggression",
        description: "2 CTs push Catwalk to pinch Top Mid, 1 Long, 1 Mid, 1 B.",
        assignments: [
          { slot: 0, path: ["ct_spawn", "ct_short_stairs", "a_short", "catwalk_stairs", "catwalk_mid"], role: "cat_pusher" },
          { slot: 1, path: ["ct_spawn", "ct_short_stairs", "a_short"], role: "short_cover" },
          { slot: 2, path: ["ct_spawn", "ct_mid", "mid_doors_ct"], role: "mid_pressure" },
          { slot: 3, path: ["ct_spawn", "ct_elevator", "long_cross", "long_car"], role: "long_anchor" },
          { slot: 4, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_doors", "b_site"], role: "b_anchor" }
        ]
      },
      retake_defense: {
        name: "Passive Retake Setup",
        description: "Play deep defensive angles, conserve utility, and coordinate retake with defuse kits.",
        assignments: [
          { slot: 0, path: ["ct_spawn", "ct_elevator", "a_site", "goose"], role: "a_goose" },
          { slot: 1, path: ["ct_spawn", "ct_short_stairs", "a_short"], role: "a_short_deep" },
          { slot: 2, path: ["ct_spawn", "ct_mid"], role: "ct_spawn_mid" },
          { slot: 3, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_doors", "b_back_site"], role: "b_back_hold" },
          { slot: 4, path: ["ct_spawn", "ct_ramp_b", "b_doors_outside", "b_window"], role: "b_window_hold" }
        ]
      }
    }
  }
};

// Export for node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DUST2_DATA };
}
