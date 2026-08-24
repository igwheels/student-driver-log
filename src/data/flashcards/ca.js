/**
 * California flashcard deck.
 *
 * Grounded in the official California Driver's Handbook published by the
 * California DMV: https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/
 *
 * `ref` is the page printed on the manual page the answer comes from, so any
 * card can be checked against the source.
 *
 * Note how many of these differ from Nebraska's: California's under-21 limit
 * is 0.01% where Nebraska's is .02%, and California has 15 mph limits for
 * blind intersections, alleys and rail crossings that Nebraska has no
 * equivalent of. That divergence is why decks are written per state rather
 * than shared.
 */
export const CA_DECK = [
  // --- Provisional licence -------------------------------------------------
  { id: 'ca-prov-1', category: 'Licensing', ref: 'p. 4',
    q: 'During the first 12 months with a provisional licence, a driver under 18 may not drive between:',
    choices: ['10 p.m. and 5 a.m.', '11 p.m. and 5 a.m.', 'Midnight and 6 a.m.', '11 p.m. and 6 a.m.'], answer: 1 },
  { id: 'ca-prov-2', category: 'Licensing', ref: 'p. 4',
    q: 'A provisional driver may not carry passengers under what age, unless accompanied by a licensed driver 25 or older?',
    choices: ['16', '18', '20', '21'], answer: 2 },
  { id: 'ca-prov-3', category: 'Licensing', ref: 'p. 4',
    q: 'Which is a valid exception to a provisional driver’s restrictions?',
    choices: ['Driving with a friend who has a licence', 'Driving for work, carrying a note signed by the employer', 'Driving on weekends only', 'Driving under the speed limit'], answer: 1 },

  // --- Alcohol -------------------------------------------------------------
  { id: 'ca-alc-1', category: 'Alcohol & Drugs', ref: 'p. 82',
    q: 'In California it is illegal to drive with a BAC of what, if you are over 21?',
    choices: ['0.01% or higher', '0.04% or higher', '0.05% or higher', '0.08% or higher'], answer: 3 },
  { id: 'ca-alc-2', category: 'Alcohol & Drugs', ref: 'p. 82',
    q: 'If you are under 21, it is illegal to drive in California with a BAC of:',
    choices: ['0.01% or higher', '0.02% or higher', '0.05% or higher', '0.08% or higher'], answer: 0 },
  { id: 'ca-alc-3', category: 'Alcohol & Drugs', ref: 'p. 82',
    q: 'What BAC makes it illegal to drive if you are on DUI probation, at any age?',
    choices: ['0.01% or higher', '0.04% or higher', '0.08% or higher', 'Any measurable amount is allowed'], answer: 0 },
  { id: 'ca-alc-4', category: 'Alcohol & Drugs', ref: 'p. 82',
    q: 'What is the BAC limit when driving a passenger for hire?',
    choices: ['0.01%', '0.04%', '0.08%', '0.10%'], answer: 1 },

  // --- Speed ---------------------------------------------------------------
  { id: 'ca-spd-1', category: 'Speed', ref: 'p. 52',
    q: 'Unless otherwise posted, the speed limit in a California business or residential district is:',
    choices: ['15 mph', '20 mph', '25 mph', '35 mph'], answer: 2 },
  { id: 'ca-spd-2', category: 'Speed', ref: 'p. 51',
    q: 'The speed limit at a blind intersection — one with no stop signs at any corner — is:',
    choices: ['10 mph', '15 mph', '20 mph', '25 mph'], answer: 1 },
  { id: 'ca-spd-3', category: 'Speed', ref: 'p. 51',
    q: 'The speed limit in an alley is:',
    choices: ['10 mph', '15 mph', '20 mph', '25 mph'], answer: 1 },
  { id: 'ca-spd-4', category: 'Speed', ref: 'p. 50',
    q: 'The speed limit within 500 feet of a school, while children are outside or crossing, is:',
    choices: ['15 mph', '20 mph', '25 mph', '35 mph'], answer: 2 },
  { id: 'ca-spd-5', category: 'Speed', ref: 'p. 51',
    q: 'The speed limit within 100 feet of a railroad crossing, where you cannot see the tracks for 400 feet in both directions, is:',
    choices: ['15 mph', '20 mph', '25 mph', 'The posted limit applies'], answer: 0 },

  // --- Railroad ------------------------------------------------------------
  { id: 'ca-rr-1', category: 'Railroad', ref: 'p. 51',
    q: 'When a crossing device or person warns that a train is coming, you must stop at least how far from the nearest track?',
    choices: ['5 feet', '10 feet', '15 feet', '25 feet'], answer: 2 },
  { id: 'ca-rr-2', category: 'Railroad', ref: 'p. 51',
    q: 'At flashing red warning lights at a rail crossing, you must:',
    choices: ['Proceed once the gate rises, even if lights still flash', 'Stop and wait until the red lights stop flashing', 'Slow to 15 mph and continue', 'Proceed if no train is visible'], answer: 1 },
  { id: 'ca-rr-3', category: 'Railroad', ref: 'p. 52',
    q: 'You should never begin crossing railroad tracks unless:',
    choices: ['The gate is rising', 'You have enough room to completely cross the tracks', 'You can cross within 15 seconds', 'A train has just passed'], answer: 1 },

  // --- School buses --------------------------------------------------------
  { id: 'ca-bus-1', category: 'Sharing the Road', ref: 'p. 51',
    q: 'When a school bus flashes red lights, you must stop from either direction. Failing to stop can bring a fine of up to:',
    choices: ['$250', '$500', '$1,000', '$2,500'], answer: 2 },
  { id: 'ca-bus-2', category: 'Sharing the Road', ref: 'p. 51',
    q: 'You do NOT need to stop for a school bus flashing red lights when:',
    choices: ['It is daytime', 'The bus is on the other side of a divided or multilane highway', 'No children are visible', 'You are travelling under 25 mph'], answer: 1 },
  { id: 'ca-bus-3', category: 'Sharing the Road', ref: 'p. 50',
    q: 'Yellow flashing lights on a school bus mean:',
    choices: ['The bus is about to turn', 'Slow down and prepare to stop — the bus is preparing to stop', 'You may pass safely', 'The bus has broken down'], answer: 1 },

  // --- Parking -------------------------------------------------------------
  { id: 'ca-prk-1', category: 'Parking', ref: 'p. 28',
    q: 'You may not park within how many feet of a fire hydrant?',
    choices: ['10 feet', '15 feet', '20 feet', '25 feet'], answer: 1 },
  { id: 'ca-prk-2', category: 'Parking', ref: 'p. 28',
    q: 'You may not park within how many feet of a marked or unmarked crosswalk?',
    choices: ['10 feet', '15 feet', '20 feet', '30 feet'], answer: 2 },
  { id: 'ca-prk-3', category: 'Parking', ref: 'p. 28',
    q: 'You may not park within how many feet of a sidewalk ramp for disabled persons?',
    choices: ['Three feet', 'Five feet', 'Ten feet', 'Fifteen feet'], answer: 0 },
  { id: 'ca-prk-4', category: 'Parking', ref: 'p. 29',
    q: 'If you must stop on a freeway, you should:',
    choices: ['Stop in the right lane with hazards on', 'Park completely off the pavement and stay in the vehicle with doors locked', 'Stand outside the vehicle to flag help', 'Walk to the nearest exit'], answer: 1 },

  // --- Turning and signaling -----------------------------------------------
  { id: 'ca-trn-1', category: 'Turning & Signaling', ref: 'p. 17',
    q: 'You should start signaling about how far before a turn?',
    choices: ['50 feet', '100 feet', '200 feet', '300 feet'], answer: 1 },
  { id: 'ca-trn-2', category: 'Turning & Signaling', ref: 'p. 21',
    q: 'A centre left turn lane may be used to:',
    choices: ['Pass slower traffic', 'Make a left turn or U-turn', 'Travel for up to 200 feet', 'Merge onto a freeway'], answer: 1 },

  // --- Defensive driving ---------------------------------------------------
  { id: 'ca-def-1', category: 'Defensive Driving', ref: 'p. 45',
    q: 'What following distance does the handbook recommend?',
    choices: ['One second', 'Two seconds', 'Three seconds', 'Five seconds'], answer: 2 },

  // --- Occupant safety -----------------------------------------------------
  { id: 'ca-belt-1', category: 'Occupant Safety', ref: 'p. 66',
    q: 'Children under 2 years old — and under 40 pounds and under 3 feet 4 inches — must be secured in:',
    choices: ['A booster seat', 'A forward-facing child seat', 'A rear-facing child passenger restraint system', 'A regular safety belt'], answer: 2 },
  { id: 'ca-belt-2', category: 'Occupant Safety', ref: 'p. 66',
    q: 'Children under 8 years old, or less than 4 feet 9 inches tall, must be secured in a child passenger restraint system:',
    choices: ['In the front seat', 'In a rear seat', 'Anywhere in the vehicle', 'Only on trips over 25 miles'], answer: 1 },
  { id: 'ca-belt-3', category: 'Occupant Safety', ref: 'p. 66',
    q: 'A child in a rear-facing child restraint may not ride:',
    choices: ['In the back seat', 'In the front seat of an airbag-equipped vehicle', 'In a two-door vehicle', 'On the freeway'], answer: 1 },

  // --- Other roadway rules -------------------------------------------------
  { id: 'ca-oth-1', category: 'Rules of the Road', ref: 'p. 52',
    q: 'In California it is illegal to smoke in a vehicle when:',
    choices: ['The windows are closed', 'A minor is in the vehicle', 'You are on a freeway', 'The vehicle is parked'], answer: 1 },
  { id: 'ca-oth-2', category: 'Rules of the Road', ref: 'p. 50',
    q: 'When towing a trailer, you must drive:',
    choices: ['In any lane', 'In the far-right lane or a lane marked for slower vehicles', 'In the left lane', 'Only on surface streets'], answer: 1 },
  { id: 'ca-oth-3', category: 'Rules of the Road', ref: 'p. 53',
    q: 'Cargo extending more than 4 feet beyond the rear bumper must display:',
    choices: ['Nothing, if under 6 feet', 'A 12-inch red or fluorescent orange square flag', 'A white flag', 'Reflective tape only'], answer: 1 },
];
