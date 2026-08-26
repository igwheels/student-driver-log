/**
 * The ten behind-the-wheel skill categories Texas's DES150N log is
 * structured around (TDLR's Behind-the-Wheel Instruction Guide). Every
 * state's log lets a parent tag a logged drive with whichever of these were
 * practiced during it — optionally everywhere, but required for Texas,
 * since its own form is organized by these categories rather than by a
 * running date/duration grid.
 *
 * `short` is what appears on the log's own "Skills Practiced" or "Comments"
 * column for states that have one (Colorado, New Hampshire, Minnesota) —
 * kept brief to fit a single grid cell. `label` is the full official wording,
 * shown on the tag itself so a parent can see exactly what Texas asks for.
 */
export const SKILL_CATEGORIES = [
  {
    key: 'getting-ready',
    label: 'Getting Ready, Starting, Placing the Vehicle in Motion, and Stopping',
    short: 'Getting Ready',
  },
  {
    key: 'moving-stopping-steering',
    label: 'Moving, Stopping, Steering, Knowing Where You Are',
    short: 'Moving/Stopping/Steering',
  },
  { key: 'backing', label: 'Backing', short: 'Backing' },
  {
    key: 'turning-lane-position',
    label: 'Turning, Lane Position, and Visual Skills',
    short: 'Turning/Lane Position',
  },
  {
    key: 'searching-path',
    label: 'Searching Intended Path of Travel',
    short: 'Searching Path',
  },
  { key: 'parking', label: 'Parking', short: 'Parking' },
  { key: 'turnabouts', label: 'Turnabouts', short: 'Turnabouts' },
  {
    key: 'multiple-lane',
    label: 'Multiple Lane Roadways',
    short: 'Multiple Lane Roadways',
  },
  { key: 'city-driving', label: 'City Driving', short: 'City Driving' },
  {
    key: 'expressway',
    label: 'Expressway/Freeway Driving',
    short: 'Expressway/Freeway',
  },
];

const BY_KEY = new Map(SKILL_CATEGORIES.map((c) => [c.key, c]));

export function skillLabel(key) {
  return BY_KEY.get(key)?.label ?? key;
}

export function skillShortLabel(key) {
  return BY_KEY.get(key)?.short ?? key;
}

/** Joined short labels for a drive's tagged skills, or '' if none. */
export function formatSkills(skills) {
  if (!skills || skills.length === 0) return '';
  return skills.map(skillShortLabel).join('; ');
}
