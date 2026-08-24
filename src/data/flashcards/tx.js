/**
 * Texas flashcard deck.
 *
 * Grounded in the official Texas Driver Handbook (DL-7) published by the
 * Texas Department of Public Safety:
 * https://www.dps.texas.gov/internetforms/forms/dl-7.pdf
 *
 * `ref` is the page printed on the manual page (the PDF runs 6 ahead).
 *
 * Coverage follows the handbook's own chapters:
 *   Ch1  your license to drive — GDL restrictions
 *   Ch3  safety responsibility — insurance
 *   Ch4  right-of-way
 *   Ch5  signals, signs, and markers
 *   Ch6  signaling, passing, and turning
 *   Ch7  parking, stopping, or standing
 *   Ch8  speed and speed limits
 *   Ch9  special driving situations
 *   Ch10 alcohol and drug impact
 *   Ch11 motor vehicle crashes
 *   Ch12 pedestrian safety
 *   Ch13 bicycle laws
 *
 * Texas diverges sharply from the other decks in three places worth noting,
 * because carrying any of them across would have been wrong: minors face a
 * zero-tolerance rule at ANY detectable amount of alcohol (Nebraska .02%,
 * California 0.01%); the following-distance rule is 2 seconds at or below
 * 30 mph and 4 seconds above it, rather than a flat three seconds; and the
 * urban district limit is 30 mph.
 */
export const TX_DECK = [
  // ===== Ch1 — Licensing and GDL ==========================================
  { id: 'tx-gdl-1', category: 'Licensing', ref: 'p. 3',
    q: 'During Phase One of a Texas provisional licence, a driver may not drive between:',
    choices: ['10 p.m. and 5 a.m.', '11 p.m. and 5 a.m.', 'Midnight and 5:00 a.m.', 'Midnight and 6:00 a.m.'], answer: 2 },
  { id: 'tx-gdl-2', category: 'Licensing', ref: 'p. 3',
    q: 'A Texas provisional driver may carry how many passengers under 21 who are not family members?',
    choices: ['None', 'No more than one', 'No more than two', 'No limit'], answer: 1 },

  // ===== Ch3 — Safety responsibility (insurance) ==========================
  { id: 'tx-ins-1', category: 'Insurance', ref: 'p. 18',
    q: 'Texas minimum liability coverage for injury or death of one person is:',
    choices: ['$25,000', '$30,000', '$50,000', '$60,000'], answer: 1 },
  { id: 'tx-ins-2', category: 'Insurance', ref: 'p. 18',
    q: 'Texas minimum liability coverage for injury or death of two or more individuals is:',
    choices: ['$30,000', '$50,000', '$60,000', '$100,000'], answer: 2 },
  { id: 'tx-ins-3', category: 'Insurance', ref: 'p. 18',
    q: 'Texas minimum liability coverage for property damage is:',
    choices: ['$15,000', '$20,000', '$25,000', '$30,000'], answer: 2 },
  { id: 'tx-ins-4', category: 'Insurance', ref: 'p. 18',
    q: 'A driving privilege may be suspended if a judgment resulting from a crash has not been satisfied within:',
    choices: ['30 days', '60 days', '90 days', 'One year'], answer: 1 },

  // ===== Ch4 — Right-of-way ===============================================
  { id: 'tx-row-1', category: 'Right-of-Way', ref: 'p. 20',
    q: 'The handbook describes right-of-way as something that is:',
    choices: ['Taken when you arrive first', 'Given, not taken', 'Determined by vehicle size', 'Decided by posted signs only'], answer: 1 },
  { id: 'tx-row-2', category: 'Right-of-Way', ref: 'p. 20',
    q: 'If you are driving on an unpaved road that intersects a paved road, you must:',
    choices: ['Proceed first', 'Yield the right-of-way to traffic on the paved road', 'Sound your horn', 'Stop for 3 seconds then go'], answer: 1 },
  { id: 'tx-row-3', category: 'Right-of-Way', ref: 'p. 20',
    q: 'When entering a road with three or more lanes, or a divided road, from a road with fewer lanes, you must:',
    choices: ['Merge at speed', 'Yield the right-of-way to vehicles on the divided or wider road', 'Take the right-of-way', 'Stop completely first'], answer: 1 },
  { id: 'tx-row-4', category: 'Right-of-Way', ref: 'p. 21',
    q: 'When turning left, you must yield to:',
    choices: ['Only pedestrians', 'Any vehicle coming straight through from the other direction', 'Nobody, if you have a green light', 'Only vehicles turning right'], answer: 1 },
  { id: 'tx-row-5', category: 'Right-of-Way', ref: 'p. 21',
    q: 'When exiting a driveway or alley across a sidewalk, you must:',
    choices: ['Proceed slowly without stopping', 'Stop prior to the sidewalk and yield to all approaching vehicles and pedestrians', 'Sound your horn and proceed', 'Yield only to vehicles'], answer: 1 },

  // ===== Ch6 — Signaling, passing, turning ================================
  { id: 'tx-sig-1', category: 'Turning & Signaling', ref: 'p. 38',
    q: 'You must signal continuously for at least how far before turning?',
    choices: ['50 feet', '100 feet', '200 feet', '300 feet'], answer: 1 },
  { id: 'tx-sig-2', category: 'Turning & Signaling', ref: 'p. 38',
    q: 'Before slowing down to turn, you should signal and slow down at least:',
    choices: ['50 feet before', '100 feet before', '25 feet before', 'No advance warning is required'], answer: 1 },

  // ===== Ch7 — Parking, stopping, standing ================================
  { id: 'tx-prk-1', category: 'Parking', ref: 'p. 42',
    q: 'You may not park within how many feet of a fire hydrant?',
    choices: ['10 feet', '15 feet', '20 feet', '30 feet'], answer: 1 },
  { id: 'tx-prk-2', category: 'Parking', ref: 'p. 42',
    q: 'You may not park within how many feet of a crosswalk at an intersection?',
    choices: ['10 feet', '15 feet', '20 feet', '30 feet'], answer: 2 },
  { id: 'tx-prk-3', category: 'Parking', ref: 'p. 42',
    q: 'You may not park within how many feet upon the approach to a flashing signal, stop sign or yield sign?',
    choices: ['15 feet', '20 feet', '30 feet', '50 feet'], answer: 2 },
  { id: 'tx-prk-4', category: 'Parking', ref: 'p. 42',
    q: 'You may not park within how many feet of the nearest rail of a railroad crossing?',
    choices: ['15 feet', '25 feet', '50 feet', '100 feet'], answer: 2 },
  { id: 'tx-prk-5', category: 'Parking', ref: 'p. 42',
    q: 'You may not park within how many feet of the driveway entrance to a fire station?',
    choices: ['10 feet', '20 feet', '30 feet', '50 feet'], answer: 1 },
  { id: 'tx-prk-6', category: 'Parking', ref: 'p. 42',
    q: 'On the side of a street opposite a fire station entrance, you may not park within:',
    choices: ['25 feet', '50 feet', '75 feet', '100 feet'], answer: 2 },
  { id: 'tx-prk-7', category: 'Parking', ref: 'p. 43',
    q: 'If you must park on the paved part of a highway, your vehicle must be visible from each direction for at least:',
    choices: ['100 feet', '200 feet', '400 feet', '500 feet'], answer: 1 },
  { id: 'tx-prk-8', category: 'Parking', ref: 'p. 42',
    q: 'You may not park on:',
    choices: ['A residential street', 'A bridge, elevated structure, or within a highway tunnel', 'A one-way street', 'A gravel shoulder'], answer: 1 },
  { id: 'tx-prk-9', category: 'Parking', ref: 'p. 43',
    q: 'You may park in a disabled parking space:',
    choices: ['For up to 15 minutes', 'Only with a disabled licence plate or state-issued placard', 'If no other space is available', 'While the engine is running'], answer: 1 },

  // ===== Ch8 — Speed and following distance ===============================
  { id: 'tx-spd-1', category: 'Speed', ref: 'p. 46',
    q: 'Unless otherwise posted, the maximum speed limit in a Texas urban district is:',
    choices: ['20 mph', '25 mph', '30 mph', '35 mph'], answer: 2 },
  { id: 'tx-spd-2', category: 'Speed', ref: 'p. 46',
    q: 'The speed limit in an alley is:',
    choices: ['10 mph', '15 mph', '20 mph', '25 mph'], answer: 1 },
  { id: 'tx-spd-3', category: 'Speed', ref: 'p. 46',
    q: 'On beaches and county roads adjacent to a public beach, the speed limit is:',
    choices: ['10 mph', '15 mph', '20 mph', '30 mph'], answer: 1 },
  { id: 'tx-spd-4', category: 'Speed', ref: 'p. 46',
    q: 'For passenger cars on a Texas- or U.S.-numbered highway outside an urban district, the maximum speed is:',
    choices: ['55 mph', '60 mph', '70 mph', '75 mph'], answer: 2 },
  { id: 'tx-spd-5', category: 'Speed', ref: 'p. 46',
    q: 'For passenger cars on a highway NOT numbered by Texas or the U.S. and outside an urban district, the maximum speed is:',
    choices: ['50 mph', '55 mph', '60 mph', '70 mph'], answer: 2 },
  { id: 'tx-spd-6', category: 'Speed', ref: 'p. 46',
    q: 'Many Texas limited-access highways have posted speed limits of:',
    choices: ['65 up to 70 mph', '70 up to 75 mph', '75 up to 85 mph', '85 up to 90 mph'], answer: 2 },
  { id: 'tx-spd-7', category: 'Speed', ref: 'p. 45',
    q: 'At speeds of 30 mph or less, the minimum following time is:',
    choices: ['1 second', '2 seconds', '3 seconds', '4 seconds'], answer: 1 },
  { id: 'tx-spd-8', category: 'Speed', ref: 'p. 45',
    q: 'At speeds above 30 mph in good conditions, you should maintain a gap of:',
    choices: ['2 seconds', '3 seconds', '4 seconds', '5 seconds'], answer: 2 },
  { id: 'tx-spd-9', category: 'Speed', ref: 'p. 45',
    q: 'Which following interval does the handbook call best practice for a beginning or less experienced driver?',
    choices: ['Two seconds', 'Three seconds', 'Four seconds', 'Six seconds'], answer: 2 },

  // ===== Ch8 — Move Over / Slow Down ======================================
  { id: 'tx-mov-1', category: 'Move Over Law', ref: 'p. 46',
    q: 'Approaching a stopped emergency, tow, utility or TxDOT vehicle with lights activated, you must reduce speed to:',
    choices: ['10 mph below the limit', '20 mph below the limit', '30 mph below the limit', 'A complete stop'], answer: 1 },
  { id: 'tx-mov-2', category: 'Move Over Law', ref: 'p. 46',
    q: 'Instead of slowing, what may you do on a road with multiple lanes travelling the same direction?',
    choices: ['Sound your horn', 'Move out of the lane closest to the stopped vehicle', 'Flash your headlights', 'Stop completely'], answer: 1 },

  // ===== Ch9 — School buses ===============================================
  { id: 'tx-bus-1', category: 'School Buses', ref: 'p. 48',
    q: 'When approaching a school bus displaying alternately flashing red lights, you must:',
    choices: ['Slow to 20 mph', 'Stop, from either direction', 'Stop only if travelling behind it', 'Pass with caution'], answer: 1 },
  { id: 'tx-bus-2', category: 'School Buses', ref: 'p. 48',
    q: 'You do NOT need to stop for a school bus when:',
    choices: ['It is raining', 'The bus is on a different road, or on a controlled-access highway where the bus is in a loading zone and pedestrians may not cross', 'No children are visible', 'You are travelling under 20 mph'], answer: 1 },
  { id: 'tx-bus-3', category: 'School Buses', ref: 'p. 48',
    q: 'A first conviction for failing to stop for a school bus carries a fine of:',
    choices: ['$100 – $250', '$250 – $500', '$500 – $1,250', '$2,000 – $4,000'], answer: 2 },
  { id: 'tx-bus-4', category: 'School Buses', ref: 'p. 48',
    q: 'A second conviction within 5 years carries a fine of not less than $1,000 or more than $2,000, plus:',
    choices: ['No further penalty', 'Possible licence suspension for up to six months', 'Mandatory jail time', 'Vehicle impoundment'], answer: 1 },
  { id: 'tx-bus-5', category: 'School Buses', ref: 'p. 48',
    q: 'Causing serious bodily injury while passing a stopped school bus is a Class A misdemeanour punishable by a fine of up to:',
    choices: ['$1,000', '$2,000', '$4,000', '$10,000'], answer: 2 },

  // ===== Ch9 — Night driving and headlights ===============================
  { id: 'tx-nite-1', category: 'Night Driving', ref: 'p. 47',
    q: 'You must use headlights beginning and ending when?',
    choices: ['At sunset and sunrise exactly', '30 minutes after sunset until 30 minutes before sunrise', 'One hour after sunset until one hour before sunrise', 'Only when it is fully dark'], answer: 1 },
  { id: 'tx-nite-2', category: 'Night Driving', ref: 'p. 47',
    q: 'Headlights are also required any time individuals or vehicles cannot be seen clearly for at least:',
    choices: ['500 feet', '750 feet', '1,000 feet', '1,500 feet'], answer: 2 },
  { id: 'tx-nite-3', category: 'Night Driving', ref: 'p. 47',
    q: 'You must use low-beam headlights when within how far of an approaching vehicle?',
    choices: ['200 feet', '300 feet', '500 feet', '1,000 feet'], answer: 2 },
  { id: 'tx-nite-4', category: 'Night Driving', ref: 'p. 47',
    q: 'When an approaching vehicle’s headlights are too bright, you should:',
    choices: ['Look directly at them', 'Shift your eyes down to the lower right side of your traffic lane', 'Flash your own high beams', 'Close one eye'], answer: 1 },
  { id: 'tx-nite-5', category: 'Night Driving', ref: 'p. 47',
    q: 'At night you should be sure you can stop within:',
    choices: ['100 feet', 'The distance lit by your headlights', 'Three car lengths', 'The posted stopping distance'], answer: 1 },

  // ===== Ch10 — Alcohol and drugs =========================================
  { id: 'tx-alc-1', category: 'Alcohol & Drugs', ref: 'p. 55',
    q: 'A person age 21 or over in Texas is legally intoxicated at a BAC of:',
    choices: ['0.02 or more', '0.05 or more', '0.08 or more', '0.10 or more'], answer: 2 },
  { id: 'tx-alc-2', category: 'Alcohol & Drugs', ref: 'p. 55',
    q: 'Under Texas zero tolerance law, a minor commits Driving Under the Influence with:',
    choices: ['A BAC of 0.02 or more', 'A BAC of 0.01 or more', 'Any detectable amount of alcohol in their system', 'A BAC of 0.08 or more'], answer: 2 },
  { id: 'tx-alc-3', category: 'Alcohol & Drugs', ref: 'p. 55',
    q: 'Under the Texas Alcoholic Beverage Code, a minor is any individual under:',
    choices: ['18 years of age', '19 years of age', '21 years of age', '25 years of age'], answer: 2 },
  { id: 'tx-alc-4', category: 'Alcohol & Drugs', ref: 'p. 55',
    q: 'Texas law allows what amount of blood alcohol concentration for minors who drive?',
    choices: ['Up to 0.02', 'Up to 0.05', 'None at all', 'Up to 0.08'], answer: 2 },

  // ===== Ch11 — Crashes ===================================================
  { id: 'tx-crs-1', category: 'Crashes', ref: 'p. 18',
    q: 'An uninsured driver may have their licence suspended after a crash involving injury, death, or property damage of at least:',
    choices: ['$500', '$1,000', '$1,500', '$2,500'], answer: 1 },

  // ===== Ch5 — Signs by shape (Table 17) ==================================
  { id: 'tx-sgn-1', category: 'Signs', ref: 'p. 26',
    q: 'An octagon-shaped sign is used exclusively for:',
    choices: ['Yield signs', 'Stop signs', 'Warning signs', 'Guide signs'], answer: 1 },
  { id: 'tx-sgn-2', category: 'Signs', ref: 'p. 26',
    q: 'An equilateral triangle sign is used exclusively for:',
    choices: ['Stop signs', 'Yield signs', 'School zones', 'Railroad crossings'], answer: 1 },
  { id: 'tx-sgn-3', category: 'Signs', ref: 'p. 26',
    q: 'A diamond-shaped sign is used exclusively to:',
    choices: ['Give guide information', 'Warn of existing or possible hazards on the road or adjacent areas', 'Mark a school zone', 'Regulate speed'], answer: 1 },
  { id: 'tx-sgn-4', category: 'Signs', ref: 'p. 26',
    q: 'A pennant-shaped sign gives advance warning of:',
    choices: ['School crossings', 'No passing zones', 'Railroad crossings', 'Construction'], answer: 1 },
  { id: 'tx-sgn-5', category: 'Signs', ref: 'p. 26',
    q: 'A pentagon-shaped sign is used for:',
    choices: ['No passing zones', 'School advance and school crossing signs', 'Railroad warnings', 'Guide information'], answer: 1 },
  { id: 'tx-sgn-6', category: 'Signs', ref: 'p. 26',
    q: 'A round sign is used for:',
    choices: ['Stop signs', 'Railroad advance warning signs', 'Yield signs', 'Speed limits'], answer: 1 },
  { id: 'tx-sgn-7', category: 'Signs', ref: 'p. 26',
    q: 'A vertical rectangle sign is generally used for:',
    choices: ['Guide signs', 'Regulatory signs', 'Warning signs', 'School signs'], answer: 1 },
  { id: 'tx-sgn-8', category: 'Signs', ref: 'p. 26',
    q: 'A horizontal rectangle sign is generally used for:',
    choices: ['Guide signs', 'Regulatory signs', 'Warning signs', 'Stop signs'], answer: 0 },
];
