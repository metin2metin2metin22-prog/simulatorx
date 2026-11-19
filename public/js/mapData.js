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
    t_suicide_top: { x: 400, y: 840, name: "T Spawn Exit", neighbors: ["t_spawn", "suicide", "t_tunnels_enter"] },
    t_plat_long: { x: 530, y: 890, name: "T Long Ramp", neighbors: ["t_spawn", "outside_long"] },
    outside_long: { x: 690, y: 850, name: "Outside Long", neighbors: ["t_plat_long", "long_doors_t"] },
    t_tunnels_enter: { x: 280, y: 830, name: "T Tunnels Entrance", neighbors: ["t_spawn", "t_suicide_top", "upper_tunnels_1"] },

    // Long A Route
    long_doors_t: { x: 720, y: 800, name: "Long Doors (T)", neighbors: ["outside_long", "long_doors_ct"] },
    long_doors_ct: { x: 740, y: 720, name: "Long Doors (CT)", neighbors: ["long_doors_t", "long_corner"] },
    long_corner: { x: 880, y: 680, name: "Long Corner", neighbors: ["long_doors_ct", "long_pit", "long_street"] },
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
    mid_palm: { x: 500, y: 580, name: "Palm / Mid", neighbors: ["top_mid", "lower_tunnels_exit", "mid_doors_t"] },
    xbox: { x: 530, y: 520, name: "Xbox", neighbors: ["top_mid", "catwalk_start", "mid_palm"] },
    catwalk_start: { x: 590, y: 520, name: "Catwalk Start", neighbors: ["xbox", "catwalk_mid"] },
    catwalk_mid: { x: 640, y: 460, name: "Catwalk", neighbors: ["catwalk_start", "catwalk_stairs"] },
    catwalk_stairs: { x: 670, y: 390, name: "Short Stairs", neighbors: ["catwalk_mid", "a_short"] },
    a_short: { x: 740, y: 300, name: "A Short", neighbors: ["catwalk_stairs", "a_short_site", "ct_short_stairs"] },
    a_short_site: { x: 790, y: 220, name: "A Short Site", neighbors: ["a_short", "a_site", "goose"] },

    // Middle Route
    mid_doors_t: { x: 510, y: 460, name: "Mid Doors", neighbors: ["mid_palm", "mid_doors_ct"] },
    mid_doors_ct: { x: 515, y: 380, name: "Mid Doors (CT)", neighbors: ["mid_doors_t", "ct_mid"] },
    ct_mid: { x: 540, y: 310, name: "CT Mid", neighbors: ["mid_doors_ct", "ct_spawn", "ct_ramp_b"] },
    ct_spawn: { x: 635, y: 215, name: "CT Spawn", neighbors: ["ct_mid", "ct_elevator", "ct_short_stairs"] },
    ct_elevator: { x: 760, y: 200, name: "CT Elevator", neighbors: ["ct_spawn", "long_cross", "a_site"] },
    ct_short_stairs: { x: 690, y: 250, name: "CT to Short", neighbors: ["ct_spawn", "a_short"] },

    // B Route via Tunnels
    upper_tunnels_1: { x: 260, y: 740, name: "Upper Tunnels (Entry)", neighbors: ["t_tunnels_enter", "upper_tunnels_mid"] },
    upper_tunnels_mid: { x: 240, y: 620, name: "Upper Tunnels", neighbors: ["upper_tunnels_1", "lower_tunnels_stairs", "upper_tunnels_stairs"] },
    lower_tunnels_stairs: { x: 330, y: 640, name: "Lower Tunnels (Stairs)", neighbors: ["upper_tunnels_mid", "lower_tunnels_exit"] },
    lower_tunnels_exit: { x: 420, y: 590, name: "Lower Tunnels (Exit)", neighbors: ["lower_tunnels_stairs", "mid_palm"] },
    upper_tunnels_stairs: { x: 230, y: 470, name: "Upper Tunnels (Stairs)", neighbors: ["upper_tunnels_mid", "b_tunnels_exit"] },
    b_tunnels_exit: { x: 210, y: 330, name: "Upper Tunnels Exit", neighbors: ["upper_tunnels_stairs", "b_platform", "b_car"] },

    // B Site
    b_platform: { x: 190, y: 220, name: "B Platform", neighbors: ["b_tunnels_exit", "b_site", "b_car"] },
    b_car: { x: 160, y: 200, name: "B Car", neighbors: ["b_tunnels_exit", "b_platform", "b_site"] },
    b_site: { x: 215, y: 123, name: "B Site", neighbors: ["b_platform", "b_car", "b_back_site", "b_window", "b_doors"] },
    b_back_site: { x: 170, y: 90, name: "B Back Site", neighbors: ["b_site"] },
    b_window: { x: 280, y: 175, name: "B Window", neighbors: ["b_site", "b_doors_outside"] },
    b_doors: { x: 320, y: 200, name: "B Doors", neighbors: ["b_site", "b_doors_outside"] },
    b_doors_outside: { x: 350, y: 240, name: "Outside B Doors", neighbors: ["b_doors", "b_window", "ct_ramp_b"] },
    ct_ramp_b: { x: 440, y: 270, name: "CT Ramp to B", neighbors: ["b_doors_outside", "ct_mid"] }
  },

  // Wall segments for Line Of Sight (blocks vision and bullet penetration)
  walls: [
    // B Tunnels outer walls
    { x1: 180, y1: 850, x2: 180, y2: 350 },
    { x1: 280, y1: 700, x2: 280, y2: 400 },
    // B Site structure
    { x1: 120, y1: 60, x2: 360, y2: 60 },
    { x1: 120, y1: 60, x2: 120, y2: 250 },
    { x1: 120, y1: 250, x2: 160, y2: 350 },
    // Mid walls
    { x1: 440, y1: 820, x2: 440, y2: 480 },
    { x1: 560, y1: 700, x2: 560, y2: 550 },
    { x1: 470, y1: 420, x2: 470, y2: 300 },
    { x1: 580, y1: 420, x2: 580, y2: 300 },
    // Long walls
    { x1: 650, y1: 820, x2: 650, y2: 700 },
    { x1: 780, y1: 820, x2: 780, y2: 650 },
    { x1: 820, y1: 600, x2: 820, y2: 320 },
    { x1: 960, y1: 700, x2: 960, y2: 200 },
    // A Site boundary
    { x1: 720, y1: 60, x2: 920, y2: 60 },
    { x1: 700, y1: 150, x2: 700, y2: 250 }
  ],

  // Pre-configured strategy waypoints
  strategies: {
    T: {
      rush_b: {
        name: "Rush B Don't Stop",
        description: "All 5 Ts rush through Upper Tunnels directly to B Site with flashes.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_stairs", "b_tunnels_exit", "b_platform", "b_site"], role: "entry" },
          { slot: 1, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_stairs", "b_tunnels_exit", "b_car", "b_site"], role: "planter" },
          { slot: 2, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_stairs", "b_tunnels_exit", "b_window"], role: "support" },
          { slot: 3, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_stairs", "b_tunnels_exit", "b_doors"], role: "support" },
          { slot: 4, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "b_tunnels_exit", "b_platform"], role: "rearguard" }
        ]
      },
      long_a_execute: {
        name: "Long A Execute",
        description: "4 Ts take Long control with utility and push A Site; 1 lurks Catwalk.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t", "long_doors_ct", "long_corner", "long_street", "long_cross", "a_ramp", "a_site"], role: "entry" },
          { slot: 1, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t", "long_doors_ct", "long_corner", "long_street", "long_cross", "a_site"], role: "planter" },
          { slot: 2, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t", "long_doors_ct", "long_corner", "long_pit"], role: "pit_anchor" },
          { slot: 3, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t", "long_doors_ct", "long_corner", "long_car"], role: "support" },
          { slot: 4, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "xbox", "catwalk_start", "catwalk_mid", "catwalk_stairs", "a_short"], role: "cat_lurk" }
        ]
      },
      a_split: {
        name: "A Split (Short & Long)",
        description: "2 Ts push Long A, 3 Ts push Catwalk Short into A Site together.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t", "long_doors_ct", "long_corner", "long_cross", "a_site"], role: "long_entry" },
          { slot: 1, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t", "long_doors_ct", "long_corner", "long_street"], role: "long_support" },
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
          { slot: 2, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_stairs", "b_tunnels_exit", "b_platform", "b_site"], role: "planter" },
          { slot: 3, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid", "upper_tunnels_stairs", "b_tunnels_exit", "b_car"], role: "tunnel_entry" },
          { slot: 4, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm", "lower_tunnels_exit"], role: "lower_cut" }
        ]
      },
      default_pick: {
        name: "Default (Map Control)",
        description: "Probe all lanes for opening picks, then coordinate plant on the open site.",
        assignments: [
          { slot: 0, path: ["t_spawn", "t_plat_long", "outside_long", "long_doors_t"], role: "long_probe" },
          { slot: 1, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "mid_palm"], role: "mid_probe" },
          { slot: 2, path: ["t_spawn", "t_suicide_top", "suicide", "top_mid", "xbox", "catwalk_start"], role: "cat_probe" },
          { slot: 3, path: ["t_spawn", "t_tunnels_enter", "upper_tunnels_1", "upper_tunnels_mid"], role: "tunnels_probe" },
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
          { slot: 0, path: ["ct_spawn", "ct_elevator", "long_cross", "long_street", "long_corner", "long_doors_ct"], role: "long_pusher_1" },
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
