/* Yale Outdoors site settings. Edit this file for the few things that live in code.
   Everything the board changes often (events, break trip details, photos, Zelle) can be edited
   without touching code once API_URL is set. See Code.gs for the one-time setup. */
window.YO = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxTQDjX2pB3RfQ__5OC2g4Dl7zKbxfoRPeyXDIKj4DTbe_X8_-9m9RibwzEGHCcJ7ljXQ/exec',            // Paste the Apps Script Web app URL here. Empty means forms prepare an email instead.
  CLUB: 'yaleoutdoors@gmail.com',
  GEAR_MGR: '',           // Annie H.'s Yale email (part-time Gear Manager). Leave blank until you have it; gear and merch emails then go to the club inbox.
  ZELLE: 'yaleoutdoors@gmail.com', // The club Zelle is tied to the club email. The ZELLE_HANDLE row in the Sheet overrides this.
  CAL_ID: 'c_45a252457e91d6752c809c38ce0ceed0f1c3f7290dda2dc1db5af48b756c6b14@group.calendar.google.com', // The club Google Calendar. Embedded on the Trips page; the CALENDAR_ID row in the Sheet overrides it.
  CAL_PUBLIC: false,      // Set true only if the calendar is shared with the public. Then the Trips page also embeds it.
  GCAL_KEY: '',           // Optional. A Google API key (Calendar API enabled) lets the notice board read the calendar directly, with no backend. Calendar must be public.

  // Photos you drop into the photos/ folder as <slot-name>.jpg (for example home-1.jpg). List each slot name here.
  LOCAL_PHOTOS: [],

  NEWSLETTER: 'https://forms.gle/SaASJQefPbpXcXjK9',
  GROUPME: 'https://tinyurl.com/ycyogroupme',
  PNUCKLE_FORM: 'https://forms.gle/Ds56js1Lhzgz59Pu6',
  CONNECT: 'https://yaleconnect.yale.edu/YCYO/club_signup',
  INSTAGRAM: 'https://www.instagram.com/yaleoutdoors/',

  // Wording of the checkbox on the gear request. Verified against the Members tab of the Sheet.
  MEMBER_LABEL: 'I’m a Pnuckle, Leader or Board member',

  // Gear defaults, used until the Inventory tab loads (and when there is no backend).
  GEAR: [
    {name:'Fleece',owned:15,deposit:5,rate:3},
    {name:'Puff jacket',owned:4,deposit:5,rate:3},
    {name:'Rain jacket',owned:3,deposit:5,rate:2},
    {name:'Helmet',owned:3,deposit:5,rate:3},
    {name:'Daypack',owned:2,deposit:5,rate:3},
    {name:'Dry bag',owned:5,deposit:5,rate:2},
    {name:'Trekking poles',owned:8,deposit:5,rate:2},
    {name:'Sleeping bag',owned:8,deposit:20,rate:4},
    {name:'Large backpack',owned:8,deposit:30,rate:5},
    {name:'Tent (6 person)',owned:2,deposit:30,rate:7},
    {name:'Tent (4 person)',owned:1,deposit:30,rate:7},
    {name:'Boat',owned:1,deposit:0,rate:0}
  ],
  // Merch. The Merch tab of the Sheet overrides names and prices.
  MERCH: [
    {name:'Indigo Yale Outdoors shirt',price:22,note:''},
    {name:'White Yale Outdoors shirt',price:15,note:'We hold a tie-dye event once they arrive.'},
    {name:'Yale Outdoors sweatpants',price:37,note:''}
  ],
  MERCH_SIZES: ['XS','S','M','L','XL','XXL'],
  MERCH_PAY: 'Zelle to yaleoutdoors@gmail.com, Venmo to @Tyler-Wu-1, or exact cash',

  GRAD_MULT: 2,
  MEM_MULT: 0.5,

  // Break trips. The Trips tab of the Sheet overrides status, dates, destination and apply link.
  TRIPS: {
    october: {status:'Details coming soon', dates:'', destination:'', apply:''},
    winter:  {status:'Details coming soon', dates:'', destination:'', apply:''},
    spring:  {status:'Details coming soon', dates:'', destination:'', apply:''}
  },

  // The usual year, used on the notice board when the Events tab has little to show.
  // m is the month number. These are habits, not dates.
  USUAL: [
    {m:[8,9],t:'Student Activities Fair',n:'Find our table'},
    {m:[9],t:'First-year East Rock hike',n:'A Sunday afternoon'},
    {m:[9,1],t:'Pnuckle sign-ups open',n:'At the start of each semester'},
    {m:[9,10],t:'Sleeping Giant day trip'},
    {m:[9,10],t:'Beach bonfire'},
    {m:[9,10,11],t:'Pnuckle retreat',n:'An overnight for all Pnuckles'},
    {m:[9,10,2,3],t:'YOHO',n:'Yale Outdoors Happy Hour'},
    {m:[10],t:'October Break trips'},
    {m:[10],t:'Kayaking on the Mill River'},
    {m:[11],t:'Harvard–Yale crunchyfest',n:'Around The Game'},
    {m:[11,12,4,5],t:'Pnuckle initiation',n:'End of the semester'},
    {m:[1],t:'Winter Break trip',n:'After New Year’s'},
    {m:[1,2],t:'Polar Plunge at Lighthouse Point',n:'Every year since 2010'},
    {m:[3],t:'Spring Break trips'},
    {m:[3,4],t:'Board elections',n:'Active Leaders vote'},
    {m:[4],t:'Bulldog Days'},
    {m:[4,5],t:'West Rock cleanup'}
  ]
};
