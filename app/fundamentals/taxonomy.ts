import type { Gear } from "@/app/types";

// app/fundamentals/taxonomy.ts

export type TaxTechnique = {
  id: string; // stable ID (never change once logged)
  label: string; // user-facing name (can evolve)
  gear?: Gear; // default: both
  keywords?: string[]; // optional: search helpers ("russian tie", "2 on 1", etc.)
};

export type TaxCategory = {
  id: string;
  label: string; // e.g., Sweeps / Attacks / Transitions
  gear?: Gear;
  techniques: TaxTechnique[];
};

export type TaxLevel2 = {
  id: string;
  label: string; // e.g., Closed Guard, Takedowns, Side Control
  gear?: Gear;

  // Either direct techniques OR category buckets
  techniques?: TaxTechnique[];
  categories?: TaxCategory[];
};

export type TaxLevel1 = {
  id: string;
  label: string; // e.g., Standing, Guard (Bottom)
  gear?: Gear;
  nodes: TaxLevel2[];
};

export const FUNDAMENTALS_TAXONOMY: TaxLevel1[] = [
  // ===========================
  // LEVEL 1: Standing
  // ===========================
  {
    id: "l1.standing",
    label: "Standing",
    gear: "both",
    nodes: [
      {
        id: "l1.standing.l2.grip_fighting_ties",
        label: "Grip Fighting / Ties",
        gear: "both",
        techniques: [
          {
            id: "l1.standing.l2.grip_fighting_ties.tech.collar_tie",
            label: "Collar Tie",
            gear: "both",
            keywords: ["tie", "head control"],
          },
          {
            id: "l1.standing.l2.grip_fighting_ties.tech.inside_position_pummel",
            label: "Inside Position Pummel",
            gear: "both",
            keywords: ["pummel", "inside control", "hand fighting"],
          },
          {
            id: "l1.standing.l2.grip_fighting_ties.tech.two_on_one_russian_tie",
            label: "2-on-1 (Russian Tie)",
            gear: "both",
            keywords: ["2 on 1", "two on one", "russian tie"],
          },
          {
            id: "l1.standing.l2.grip_fighting_ties.tech.underhook_control",
            label: "Underhook Control",
            gear: "both",
            keywords: ["underhook"],
          },
          {
            id: "l1.standing.l2.grip_fighting_ties.tech.overhook_whizzer",
            label: "Overhook / Whizzer",
            gear: "both",
            keywords: ["overhook", "whizzer"],
          },
          {
            id: "l1.standing.l2.grip_fighting_ties.tech.wrist_control",
            label: "Wrist Control",
            gear: "both",
            keywords: ["wrist", "hand fighting"],
          },
        ],
      },
      {
        id: "l1.standing.l2.takedowns",
        label: "Takedowns",
        gear: "both",
        techniques: [
          {
            id: "l1.standing.l2.takedowns.tech.single_leg",
            label: "Single Leg",
            gear: "both",
            keywords: ["single", "snatch single"],
          },
          {
            id: "l1.standing.l2.takedowns.tech.double_leg",
            label: "Double Leg",
            gear: "both",
            keywords: ["double"],
          },
          {
            id: "l1.standing.l2.takedowns.tech.body_lock_takedown",
            label: "Body Lock Takedown",
            gear: "both",
            keywords: ["body lock"],
          },
          {
            id: "l1.standing.l2.takedowns.tech.snapdown_front_headlock",
            label: "Snapdown to Front Headlock",
            gear: "both",
            keywords: ["snapdown", "front headlock"],
          },
          {
            id: "l1.standing.l2.takedowns.tech.inside_trip",
            label: "Inside Trip",
            gear: "both",
            keywords: ["uchi mata", "inside reap"],
          },
          {
            id: "l1.standing.l2.takedowns.tech.outside_trip",
            label: "Outside Trip",
            gear: "both",
            keywords: ["osoto", "outside reap"],
          },
        ],
      },
      {
        id: "l1.standing.l2.guard_pull_seated_entry",
        label: "Guard Pull / Seated Entry",
        gear: "both",
        techniques: [
          {
            id: "l1.standing.l2.guard_pull_seated_entry.tech.collar_sleeve_guard_pull",
            label: "Collar Sleeve Guard Pull (Gi)",
            gear: "gi",
            keywords: ["guard pull", "collar sleeve"],
          },
          {
            id: "l1.standing.l2.guard_pull_seated_entry.tech.sit_to_butterfly",
            label: "Sit to Butterfly",
            gear: "both",
            keywords: ["seated", "butterfly entry"],
          },
          {
            id: "l1.standing.l2.guard_pull_seated_entry.tech.shin_to_shin_entry",
            label: "Shin-to-Shin Entry",
            gear: "both",
            keywords: ["shin to shin"],
          },
          {
            id: "l1.standing.l2.guard_pull_seated_entry.tech.arm_drag_to_seated_guard",
            label: "Arm Drag to Seated Guard",
            gear: "both",
            keywords: ["arm drag", "seated"],
          },
        ],
      },
    ],
  },

  // ===========================
  // LEVEL 1: Guard (Bottom)
  // ===========================
  {
    id: "l1.guard_bottom",
    label: "Guard (Bottom)",
    gear: "both",
    nodes: [
      {
        id: "l1.guard_bottom.l2.closed_guard",
        label: "Closed Guard",
        gear: "both",
        categories: [
          {
            id: "l1.guard_bottom.l2.closed_guard.l3.retention",
            label: "Retention",
            gear: "both",
            techniques: [],
          },
          {
            id: "l1.guard_bottom.l2.closed_guard.l3.sweeps",
            label: "Sweeps",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.sweeps.tech.hip_bump_sweep",
                label: "Hip Bump Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.sweeps.tech.scissor_sweep",
                label: "Scissor Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.sweeps.tech.pendulum_sweep",
                label: "Pendulum Sweep",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.closed_guard.l3.attacks",
            label: "Attacks",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.attacks.tech.triangle",
                label: "Triangle",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.attacks.tech.armbar",
                label: "Armbar",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.attacks.tech.omoplata",
                label: "Omoplata",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.attacks.tech.cross_collar_choke",
                label: "Cross Collar Choke (Gi)",
                gear: "gi",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.attacks.tech.guillotine",
                label: "Guillotine",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.attacks.tech.kimura",
                label: "Kimura",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.closed_guard.l3.transitions",
            label: "Transitions",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.transitions.tech.closed_guard_to_mount",
                label: "Closed Guard to Mount",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.transitions.tech.closed_guard_to_back_take",
                label: "Closed Guard to Back Take",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.closed_guard.l3.transitions.tech.closed_guard_to_half_guard",
                label: "Closed Guard to Half Guard",
                gear: "both",
              },
            ],
          },
        ],
      },

      {
        id: "l1.guard_bottom.l2.half_guard",
        label: "Half Guard",
        gear: "both",
        categories: [
          {
            id: "l1.guard_bottom.l2.half_guard.l3.retention",
            label: "Retention",
            gear: "both",
            techniques: [],
          },
          {
            id: "l1.guard_bottom.l2.half_guard.l3.sweeps",
            label: "Sweeps",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.half_guard.l3.sweeps.tech.old_school_sweep",
                label: "Old School Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.half_guard.l3.sweeps.tech.knee_tap_sweep",
                label: "Knee Tap Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.half_guard.l3.sweeps.tech.waiter_sweep",
                label: "Waiter Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.half_guard.l3.sweeps.tech.deep_half_come_up",
                label: "Deep Half Come-Up",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.half_guard.l3.attacks",
            label: "Attacks",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.half_guard.l3.attacks.tech.kimura_from_half_guard",
                label: "Kimura from Half Guard",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.half_guard.l3.attacks.tech.guillotine_from_half_guard",
                label: "Guillotine from Half Guard",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.half_guard.l3.transitions",
            label: "Transitions",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.half_guard.l3.transitions.tech.half_guard_to_dogfight",
                label: "Half Guard to Dogfight",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.half_guard.l3.transitions.tech.half_guard_to_back",
                label: "Half Guard to Back",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.half_guard.l3.transitions.tech.half_guard_to_full_guard",
                label: "Half Guard to Full Guard",
                gear: "both",
              },
            ],
          },
        ],
      },

      {
        id: "l1.guard_bottom.l2.butterfly_guard",
        label: "Butterfly Guard",
        gear: "both",
        categories: [
          {
            id: "l1.guard_bottom.l2.butterfly_guard.l3.entries",
            label: "Entries",
            gear: "both",
            techniques: [],
          },
          {
            id: "l1.guard_bottom.l2.butterfly_guard.l3.sweeps",
            label: "Sweeps",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.sweeps.tech.basic_butterfly_elevation",
                label: "Basic Butterfly Elevation",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.sweeps.tech.shoulder_crunch_sweep",
                label: "Shoulder Crunch Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.sweeps.tech.sumi_gaeshi",
                label: "Sumi Gaeshi",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.butterfly_guard.l3.attacks",
            label: "Attacks",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.attacks.tech.guillotine",
                label: "Guillotine",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.attacks.tech.arm_drag_to_back",
                label: "Arm Drag to Back",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.attacks.tech.triangle",
                label: "Triangle",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.butterfly_guard.l3.transitions",
            label: "Transitions",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.transitions.tech.butterfly_to_x_guard",
                label: "Butterfly to X-Guard",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.butterfly_guard.l3.transitions.tech.butterfly_to_single_leg_x",
                label: "Butterfly to Single Leg X",
                gear: "both",
              },
            ],
          },
        ],
      },

      {
        id: "l1.guard_bottom.l2.open_guard",
        label: "Open Guard",
        gear: "both",
        categories: [
          {
            id: "l1.guard_bottom.l2.open_guard.l3.control",
            label: "Control",
            gear: "both",
            techniques: [],
          },
          {
            id: "l1.guard_bottom.l2.open_guard.l3.sweeps",
            label: "Sweeps",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.open_guard.l3.sweeps.tech.tripod_sweep",
                label: "Tripod Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.open_guard.l3.sweeps.tech.sickle_sweep",
                label: "Sickle Sweep",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.open_guard.l3.sweeps.tech.ankle_pick_sweep",
                label: "Ankle Pick Sweep",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.open_guard.l3.attacks",
            label: "Attacks",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.open_guard.l3.attacks.tech.triangle",
                label: "Triangle",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.open_guard.l3.attacks.tech.omoplata",
                label: "Omoplata",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.open_guard.l3.attacks.tech.armbar",
                label: "Armbar",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.open_guard.l3.transitions",
            label: "Transitions",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.open_guard.l3.transitions.tech.open_guard_to_single_leg_x",
                label: "Open Guard to Single Leg X",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.open_guard.l3.transitions.tech.open_guard_to_butterfly",
                label: "Open Guard to Butterfly",
                gear: "both",
              },
            ],
          },
        ],
      },

      {
        id: "l1.guard_bottom.l2.leg_entanglements",
        label: "Leg Entanglements",
        gear: "both",
        categories: [
          {
            id: "l1.guard_bottom.l2.leg_entanglements.l3.entries",
            label: "Entries",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.entries.tech.single_leg_x_entry",
                label: "Single Leg X Entry",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.entries.tech.k_guard_entry",
                label: "K-Guard Entry",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.leg_entanglements.l3.sweeps",
            label: "Sweeps",
            gear: "both",
            techniques: [],
          },
          {
            id: "l1.guard_bottom.l2.leg_entanglements.l3.submissions",
            label: "Submissions",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.submissions.tech.straight_ankle_lock",
                label: "Straight Ankle Lock",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.submissions.tech.heel_hook",
                label: "Heel Hook (No-Gi)",
                gear: "nogi",
              },
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.submissions.tech.kneebar",
                label: "Kneebar",
                gear: "both",
              },
            ],
          },
          {
            id: "l1.guard_bottom.l2.leg_entanglements.l3.transitions",
            label: "Transitions",
            gear: "both",
            techniques: [
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.transitions.tech.single_leg_x_to_x_guard",
                label: "Single Leg X to X-Guard",
                gear: "both",
              },
              {
                id: "l1.guard_bottom.l2.leg_entanglements.l3.transitions.tech.k_guard_to_back_take",
                label: "K-Guard to Back Take",
                gear: "both",
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================
  // LEVEL 1: Top Passing
  // ===========================
  {
    id: "l1.top_passing",
    label: "Top Passing",
    gear: "both",
    nodes: [
      {
        id: "l1.top_passing.l2.outside_passing",
        label: "Outside Passing",
        gear: "both",
        techniques: [
          { id: "l1.top_passing.l2.outside_passing.tech.toreando_pass", label: "Toreando Pass", gear: "both" },
          { id: "l1.top_passing.l2.outside_passing.tech.leg_drag_pass", label: "Leg Drag Pass", gear: "both" },
        ],
      },
      {
        id: "l1.top_passing.l2.inside_passing",
        label: "Inside Passing",
        gear: "both",
        techniques: [
          { id: "l1.top_passing.l2.inside_passing.tech.knee_cut_pass", label: "Knee Cut Pass", gear: "both" },
          { id: "l1.top_passing.l2.inside_passing.tech.smash_pass", label: "Smash Pass", gear: "both" },
        ],
      },
      {
        id: "l1.top_passing.l2.pressure_passing",
        label: "Pressure Passing",
        gear: "both",
        techniques: [
          { id: "l1.top_passing.l2.pressure_passing.tech.body_lock_pass", label: "Body Lock Pass", gear: "both" },
          { id: "l1.top_passing.l2.pressure_passing.tech.over_under_pass", label: "Over Under Pass", gear: "both" },
        ],
      },
      {
        id: "l1.top_passing.l2.half_guard_top",
        label: "Half Guard Top",
        gear: "both",
        techniques: [
          { id: "l1.top_passing.l2.half_guard_top.tech.crossface_underhook_pass", label: "Crossface + Underhook Pass", gear: "both" },
          { id: "l1.top_passing.l2.half_guard_top.tech.backstep_pass", label: "Backstep Pass", gear: "both" },
        ],
      },
    ],
  },

  // ===========================
  // LEVEL 1: Pins (Top Control)
  // ===========================
  {
    id: "l1.pins_top_control",
    label: "Pins (Top Control)",
    gear: "both",
    nodes: [
      {
        id: "l1.pins_top_control.l2.side_control",
        label: "Side Control",
        gear: "both",
        categories: [
          {
            id: "l1.pins_top_control.l2.side_control.l3.submissions",
            label: "Submissions",
            gear: "both",
            techniques: [
              { id: "l1.pins_top_control.l2.side_control.l3.submissions.tech.americana", label: "Americana", gear: "both" },
              { id: "l1.pins_top_control.l2.side_control.l3.submissions.tech.kimura", label: "Kimura", gear: "both" },
              { id: "l1.pins_top_control.l2.side_control.l3.submissions.tech.arm_triangle", label: "Arm Triangle", gear: "both" },
              { id: "l1.pins_top_control.l2.side_control.l3.submissions.tech.paper_cutter_choke", label: "Paper Cutter Choke (Gi)", gear: "gi" },
            ],
          },
        ],
      },
      {
        id: "l1.pins_top_control.l2.mount",
        label: "Mount",
        gear: "both",
        categories: [
          {
            id: "l1.pins_top_control.l2.mount.l3.submissions",
            label: "Submissions",
            gear: "both",
            techniques: [
              { id: "l1.pins_top_control.l2.mount.l3.submissions.tech.armbar", label: "Armbar", gear: "both" },
              { id: "l1.pins_top_control.l2.mount.l3.submissions.tech.ezekiel", label: "Ezekiel", gear: "both" },
              { id: "l1.pins_top_control.l2.mount.l3.submissions.tech.triangle", label: "Triangle", gear: "both" },
              { id: "l1.pins_top_control.l2.mount.l3.submissions.tech.cross_collar_choke", label: "Cross Collar Choke (Gi)", gear: "gi" },
            ],
          },
        ],
      },
      { id: "l1.pins_top_control.l2.knee_on_belly", label: "Knee on Belly", gear: "both", techniques: [] },
      { id: "l1.pins_top_control.l2.north_south", label: "North South", gear: "both", techniques: [] },
    ],
  },

  // ===========================
  // LEVEL 1: Back Control
  // ===========================
  {
    id: "l1.back_control",
    label: "Back Control",
    gear: "both",
    nodes: [
      { id: "l1.back_control.l2.controls", label: "Controls", gear: "both", techniques: [] },
      {
        id: "l1.back_control.l2.strangles",
        label: "Strangles",
        gear: "both",
        techniques: [
          { id: "l1.back_control.l2.strangles.tech.rear_naked_choke", label: "Rear Naked Choke", gear: "both", keywords: ["rnc"] },
          { id: "l1.back_control.l2.strangles.tech.short_choke", label: "Short Choke", gear: "both" },
          { id: "l1.back_control.l2.strangles.tech.bow_and_arrow", label: "Bow and Arrow (Gi)", gear: "gi", keywords: ["bow & arrow"] },
        ],
      },
      { id: "l1.back_control.l2.transitions", label: "Transitions", gear: "both", techniques: [] },
    ],
  },

  // ===========================
  // LEVEL 1: Turtle / Scramble
  // ===========================
  {
    id: "l1.turtle_scramble",
    label: "Turtle / Scramble",
    gear: "both",
    nodes: [
      {
        id: "l1.turtle_scramble.l2.top_turtle",
        label: "Top Turtle",
        gear: "both",
        techniques: [
          { id: "l1.turtle_scramble.l2.top_turtle.tech.clock_choke", label: "Clock Choke (Gi)", gear: "gi" },
          { id: "l1.turtle_scramble.l2.top_turtle.tech.back_take", label: "Back Take", gear: "both" },
          { id: "l1.turtle_scramble.l2.top_turtle.tech.spiral_ride_control", label: "Spiral Ride Control", gear: "both" },
        ],
      },
      {
        id: "l1.turtle_scramble.l2.bottom_turtle",
        label: "Bottom Turtle",
        gear: "both",
        techniques: [
          { id: "l1.turtle_scramble.l2.bottom_turtle.tech.sit_out", label: "Sit Out", gear: "both" },
          { id: "l1.turtle_scramble.l2.bottom_turtle.tech.granby_roll", label: "Granby Roll", gear: "both" },
          { id: "l1.turtle_scramble.l2.bottom_turtle.tech.stand_up", label: "Stand Up", gear: "both" },
        ],
      },
      {
        id: "l1.turtle_scramble.l2.front_headlock",
        label: "Front Headlock",
        gear: "both",
        techniques: [
          { id: "l1.turtle_scramble.l2.front_headlock.tech.guillotine", label: "Guillotine", gear: "both" },
          { id: "l1.turtle_scramble.l2.front_headlock.tech.anaconda", label: "Anaconda", gear: "nogi" },
          { id: "l1.turtle_scramble.l2.front_headlock.tech.darce", label: "Darce", gear: "nogi" },
        ],
      },
    ],
  },

  // ===========================
  // LEVEL 1: Escapes / Defense
  // ===========================
  {
    id: "l1.escapes_defense",
    label: "Escapes / Defense",
    gear: "both",
    nodes: [
      {
        id: "l1.escapes_defense.l2.escape_side_control",
        label: "Escape Side Control",
        gear: "both",
        techniques: [
          { id: "l1.escapes_defense.l2.escape_side_control.tech.hip_escape_to_guard", label: "Hip Escape to Guard", gear: "both", keywords: ["shrimp"] },
          { id: "l1.escapes_defense.l2.escape_side_control.tech.underhook_to_knees", label: "Underhook to Knees", gear: "both" },
        ],
      },
      {
        id: "l1.escapes_defense.l2.escape_mount",
        label: "Escape Mount",
        gear: "both",
        techniques: [
          { id: "l1.escapes_defense.l2.escape_mount.tech.elbow_knee_escape", label: "Elbow Knee Escape", gear: "both" },
          { id: "l1.escapes_defense.l2.escape_mount.tech.trap_and_roll", label: "Trap and Roll", gear: "both", keywords: ["upa"] },
        ],
      },
      {
        id: "l1.escapes_defense.l2.escape_back",
        label: "Escape Back",
        gear: "both",
        techniques: [
          { id: "l1.escapes_defense.l2.escape_back.tech.hand_fighting_escape", label: "Hand Fighting Escape", gear: "both" },
          { id: "l1.escapes_defense.l2.escape_back.tech.hip_slide_escape", label: "Hip Slide Escape", gear: "both" },
        ],
      },
      { id: "l1.escapes_defense.l2.escape_submissions", label: "Escape Submissions", gear: "both", techniques: [] },
    ],
  },
];