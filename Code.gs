/**
 * YALE OUTDOORS SITE BACKEND (Google Apps Script)
 * ================================================
 * What it does
 *   - Takes gear requests, merch orders, trip suggestions, Winter School interest, alumni updates and trip reports from the website.
 *   - Emails the board (club inbox + Gear Manager) and sends the requester a copy.
 *   - Every board email has a Review link. One click opens a page to approve or decline.
 *     Approving a gear request holds that gear for those dates, and the website's
 *     availability updates by itself.
 *   - Serves live stock to the website: gear owned, minus approved rentals, minus anything
 *     you block out on the Adjustments tab.
 *   - Keeps a Tracker tab: how many of each item are free on each of the next 28 days.
 *   - Runs the site's editable parts. The Events tab is the notice board and calendar. The Trips tab
 *     holds the October, Winter and Spring Break details. Photos uploaded from the site (Board
 *     login in the footer) are saved to a Drive folder and listed on the Photos tab.
 *
 * ONE-TIME SETUP (about 10 minutes)
 *   1. Signed in as yaleoutdoors@gmail.com, create a new Google Sheet. Name it "Yale Outdoors Site".
 *   2. In the Sheet: Extensions > Apps Script. Delete the sample code, paste this whole file, Save.
 *   3. In the toolbar pick the function "setup" and press Run. Approve the permissions.
 *      (Google warns the app is unverified. Choose Advanced > Go to project. It is your own script.)
 *   4. Back in the Sheet, open the Settings tab and check the emails. Add current members to the
 *      Members tab (one Yale email per row) so member rates can be verified.
 *   5. Optional but recommended: in Apps Script run "selfTest". It files a sample gear request
 *      so you can see the emails and the Review page before real people use it.
 *   6. Deploy > New deployment > gear icon > Web app.
 *        Execute as: Me.   Who has access: Anyone.   Deploy, then copy the Web app URL.
 *   7. Paste that URL into API_URL at the top of site/content.js, and host the site folder.
 *      The Board login key for photo uploads is in the Settings tab (EDIT_KEY). Give it only to the board.
 *   After you ever change this code: Deploy > Manage deployments > pencil > Version: New version.
 *
 * EVERYDAY USE
 *   - Approve or decline from the email's Review link. (You can also change the Status
 *     dropdown on the Requests tab by hand. Approved and Declined send the email for you.)
 *   - To change what is in stock, edit the Owned column on the Inventory tab.
 *   - To take gear out for certain dates (break trip hold, repair, lost), add a row on the
 *     Adjustments tab: Item, From, To, Quantity unavailable, Reason. The site shows less stock
 *     for those dates right away.
 *   - Mark a rental Picked up when it leaves, and Returned when it comes back. Returned frees
 *     the gear immediately, even if the return date has not passed.
 *   - Prices live in the Inventory tab (Yale College daily rate) and Settings tab (multipliers).
 *   - Notice board and calendar: add a row to the Events tab (Date, End date, Title, Type, Where,
 *     Details, Link, Show). Set Show to No to hide one. Past events drop off by themselves.
 *   - Break trips: edit the Trips tab (Key is october, winter or spring). Status, Dates,
 *     Destination and Apply link appear on the Trips page right away.
 *   - Photos: on the site, click "Board login" in the footer, paste the EDIT_KEY, then use
 *     Replace photo on any picture. Captions can be edited the same way.
 *   - Settings tab also holds ZELLE_HANDLE (shown on the History and giving page) and CALENDAR_ID. Events from that Google Calendar
 *     are pulled in automatically and shown on the notice board, soonest first. (Run setup again, or paste the ID in Settings.)
 */

const S = {SET: 'Settings', INV: 'Inventory', ADJ: 'Adjustments', MEM: 'Members', REQ: 'Requests', SUG: 'Suggestions', WIN: 'WinterSchool', TRK: 'Tracker', EVT: 'Events', TRP: 'Trips', PHO: 'Photos', ALU: 'Alumni', RPT: 'TripReports', MRC: 'Merch', ORD: 'MerchOrders'};
const HOLD = ['Approved', 'Picked up'];
const REQ_STATUS = ['Pending', 'Approved', 'Declined', 'Picked up', 'Returned', 'Cancelled'];
const SUG_STATUS = ['New', 'Interested', 'Scheduled', 'Not now'];
const SET_COLS = ['Setting', 'Value', 'What it does'];
const INV_COLS = ['Item', 'Owned', 'Deposit', 'Daily rate (Yale College)', 'Active'];
const ADJ_COLS = ['Item', 'From', 'To', 'Quantity unavailable', 'Reason'];
const MEM_COLS = ['Email', 'Name'];
const REQ_COLS = ['ID', 'Submitted', 'Status', 'Name', 'Email', 'School', 'Claims member', 'Member verified', 'Items', 'First pickup', 'Last return', 'Rental total', 'Deposit', 'Note', 'Decision note', 'Decided', 'Token', 'Lines (do not edit)'];
const SUG_COLS = ['ID', 'Submitted', 'Status', 'Name', 'Email', 'School', 'Kind', 'Where', 'Idea', 'Possible dates', 'Group size', 'Trip length', 'Experience', 'Equipment', 'Transportation', 'Costs and permits', 'Leading', 'Notes', 'Decision note', 'Decided', 'Token'];
const WIN_COLS = ['Submitted', 'Name', 'Email', 'School', 'Interested in', 'Topics', 'Experience'];
const EVT_COLS = ['Date', 'End date', 'Title', 'Type', 'Where', 'Details', 'Link', 'Show'];
const TRP_COLS = ['Key', 'Status', 'Dates', 'Destination', 'Apply link', 'Notes'];
const PHO_COLS = ['Slot', 'File ID', 'Caption', 'Updated'];
const ALU_COLS = ['Submitted', 'Name', 'Email', 'Class year', 'With YO as', 'Note', 'OK to write about giving'];
const RPT_COLS = ['ID', 'Submitted', 'Submitted by', 'Email', 'Destination', 'Dates', 'Weather', 'Leaders', 'Group size', 'Activity', 'Transportation', 'Expenses', 'Route', 'Maps', 'Highlights', 'Difficulties', 'Comments'];
const MRC_COLS = ['Item', 'Price', 'Active', 'Note'];
const ORD_COLS = ['ID', 'Submitted', 'Name', 'Email', 'Phone', 'Year', 'Items', 'Total', 'Payment', 'Note', 'Paid'];
const SCHOOL_LABEL = {college: 'Yale College', grad: 'Graduate or professional school'};

/* ---------------------------------------------------------------- setup */

function setup() {
  ensure_(S.SET, SET_COLS, [
    ['CLUB_EMAIL', 'yaleoutdoors@gmail.com', 'Gets every request, suggestion and decision summary.'],
    ['GEAR_MANAGER_EMAIL', '', 'Annie H.\'s Yale email (part-time Gear Manager). Also gets every gear request and merch order. Add it here.'],
    ['EXTRA_APPROVER_EMAILS', '', 'Optional. More people who get review emails. Separate with commas.'],
    ['GRAD_MULTIPLIER', 2, 'Price multiplier for graduate and professional students. The website never states it.'],
    ['MEMBER_MULTIPLIER', 0.5, 'Price multiplier for verified members (0.5 means half price).'],
    ['PICKUP_NOTE', 'The Gear Manager will email you to arrange pickup and payment.', 'Added to every approval email.'],
    ['EDIT_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 16), 'Board login key for uploading photos on the site. Keep it private. Change it any time.'],
    ['ZELLE_HANDLE', 'yaleoutdoors@gmail.com', 'Shown on the History and giving page. This is the email the club Zelle is tied to.'],
    ['MERCH_PAYMENT', 'Zelle to yaleoutdoors@gmail.com, Venmo to @Tyler-Wu-1, or exact cash (we will reach out to you).', 'Payment instructions in the merch order confirmation email.'],
    ['CALENDAR_ID', 'c_45a252457e91d6752c809c38ce0ceed0f1c3f7290dda2dc1db5af48b756c6b14@group.calendar.google.com', 'The club Google Calendar. Its upcoming events show on the notice board, soonest first, and it is embedded on the Trips page. Leave blank to use only the Events tab.']
  ]);
  ensure_(S.INV, INV_COLS, [
    ['Fleece', 15, 5, 3, 'Yes'],
    ['Puff jacket', 4, 5, 3, 'Yes'],
    ['Rain jacket', 3, 5, 2, 'Yes'],
    ['Helmet', 3, 5, 3, 'Yes'],
    ['Daypack', 2, 5, 3, 'Yes'],
    ['Dry bag', 5, 5, 2, 'Yes'],
    ['Trekking poles', 8, 5, 2, 'Yes'],
    ['Sleeping bag', 8, 20, 4, 'Yes'],
    ['Large backpack', 8, 30, 5, 'Yes'],
    ['Tent (6 person)', 2, 30, 7, 'Yes'],
    ['Tent (4 person)', 1, 30, 7, 'Yes'],
    ['Boat', 1, 0, 0, 'Yes']
  ]);
  ensure_(S.ADJ, ADJ_COLS, [['Tent (6 person)', '2026-12-28', '2027-01-08', 1, 'Example: held for Winter Break. Edit or delete this row.']]);
  ensure_(S.MEM, MEM_COLS, []);
  const req = ensure_(S.REQ, REQ_COLS, []);
  const sug = ensure_(S.SUG, SUG_COLS, []);
  ensure_(S.WIN, WIN_COLS, []);
  ensure_(S.TRK, ['Tracker'], []);
  ensure_(S.EVT, EVT_COLS, [
    ['2026-12-05', '', 'Example: Pnuckle initiation', 'Social', 'New Haven', 'Edit or delete this row. Dates are yyyy-mm-dd.', '', 'No']
  ]);
  ensure_(S.TRP, TRP_COLS, [
    ['october', 'Details coming soon', '', '', '', ''],
    ['winter', 'Details coming soon', '', '', '', ''],
    ['spring', 'Details coming soon', '', '', '', '']
  ]);
  ensure_(S.PHO, PHO_COLS, []);
  ensure_(S.MRC, MRC_COLS, [
    ['Indigo Yale Outdoors shirt', 22, 'Yes', ''],
    ['White Yale Outdoors shirt', 15, 'Yes', 'We will hold a tie-dye event once they arrive.'],
    ['Yale Outdoors sweatpants', 37, 'Yes', '']
  ]);
  ensure_(S.ORD, ORD_COLS, []);
  ensure_(S.ALU, ALU_COLS, []);
  ensure_(S.RPT, RPT_COLS, []);

  req.getRange(2, 3, 1000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(REQ_STATUS, true).build());
  sug.getRange(2, 3, 1000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(SUG_STATUS, true).build());

  const first = ss_().getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(first);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    const f = t.getHandlerFunction();
    if (f === 'onSheetEdit' || f === 'dailyRefresh') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss_()).onEdit().create();
  ScriptApp.newTrigger('dailyRefresh').timeBased().everyDays(1).atHour(3).create();

  refreshTracker_();
  SpreadsheetApp.flush();
  console.log('Setup finished. Next: check the Settings tab, add members, then Deploy as a web app.');
}

function ensure_(name, headers, seedRows) {
  let sh = ss_().getSheetByName(name);
  if (!sh) sh = ss_().insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (seedRows && seedRows.length) sh.getRange(2, 1, seedRows.length, seedRows[0].length).setValues(seedRows);
  }
  return sh;
}

/** Files a sample gear request so you can see the emails and Review page. */
function selfTest() {
  const s = settings_();
  const inv = inventory_();
  if (!inv.length) throw new Error('Add gear to the Inventory tab first.');
  const start = addDays_(today_(), 7);
  const res = handleGear_({
    type: 'gear', name: 'Test Person', email: s.gear || 'test@yale.edu', school: 'college', member: true,
    note: 'This is a test from selfTest(). Safe to decline.',
    lines: [{item: inv[0].name, qty: 1, from: start, to: addDays_(start, 2)}]
  });
  console.log(JSON.stringify(res));
}

/* ---------------------------------------------------------------- web app */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'inventory') return json_(publicInventory_());
    if (p.action === 'content') return json_(publicContent_());
    if (p.action === 'review') return reviewPage_(p.kind, p.id, p.t);
    return json_({ok: true, service: 'Yale Outdoors site backend'});
  } catch (err) {
    console.error(err);
    return json_({ok: false, error: 'Server error'});
  }
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (x) { return json_({ok: false, error: 'Bad request.'}); }
  if (p.website) return json_({ok: true});                          // honeypot: bots fill this in
  try {
    if (p.type === 'checkkey' || p.type === 'photo' || p.type === 'caption') return json_(handleEditor_(p));
    if (!rateOk_(p.email)) return json_({ok: false, error: 'Too many requests from this email. Try again in an hour, or email yaleoutdoors@gmail.com.'});
    if (p.type === 'gear') return json_(handleGear_(p));
    if (p.type === 'suggestion') return json_(handleSuggestion_(p));
    if (p.type === 'winterschool') return json_(handleWinter_(p));
    if (p.type === 'alumni') return json_(handleAlumni_(p));
    if (p.type === 'merch') return json_(handleMerch_(p));
    if (p.type === 'tripreport') return json_(handleReport_(p));
    return json_({ok: false, error: 'Unknown request.'});
  } catch (err) {
    console.error(err);
    return json_({ok: false, error: 'Something went wrong on our end. Please email yaleoutdoors@gmail.com instead.'});
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function publicInventory_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('inv');
  if (hit) return JSON.parse(hit);
  const s = settings_();
  const t = today_();
  const out = {
    ok: true,
    items: inventory_(),
    blocked: blocked_().filter(function (b) { return b.to >= t; }).map(function (b) { return {item: b.item, from: b.from, to: b.to, qty: b.qty}; }),
    settings: {gradMultiplier: s.grad, memberMultiplier: s.member},
    updated: new Date().toISOString()
  };
  cache.put('inv', JSON.stringify(out), 60);
  return out;
}

function rateOk_(email) {
  const key = 'rl:' + String(email || 'none').toLowerCase().slice(0, 100);
  const c = CacheService.getScriptCache();
  const n = Number(c.get(key) || 0);
  if (n >= 10) return false;
  c.put(key, String(n + 1), 3600);
  return true;
}


/* ---------------------------------------------------------------- site content and photos */

function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return v == null ? '' : String(v).trim();
}

function publicContent_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('content');
  if (hit) return JSON.parse(hit);
  const t = today_();
  const o = {};
  sheet_(S.SET).getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; });
  const events = table_(S.EVT).map(function (r) {
    return {date: str_(r.Date), end: str_(r['End date']), title: str_(r.Title), type: str_(r.Type), where: str_(r.Where), details: str_(r.Details), link: str_(r.Link), show: String(r.Show || 'Yes').toLowerCase() !== 'no'};
  }).filter(function (e) { return e.show && e.title && e.date && (e.end || e.date) >= t; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).slice(0, 60);
  calendarEvents_(str_(o.CALENDAR_ID)).forEach(function (c) {
    const dup = events.some(function (e) { return e.date === c.date && e.title.toLowerCase() === c.title.toLowerCase(); });
    if (!dup) events.push(c);
  });
  events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : 1; });
  events.splice(60);
  const trips = {};
  table_(S.TRP).forEach(function (r) {
    const k = str_(r.Key).toLowerCase();
    if (k) trips[k] = {status: str_(r.Status), dates: str_(r.Dates), destination: str_(r.Destination), apply: str_(r['Apply link']), notes: str_(r.Notes)};
  });
  const photos = {};
  table_(S.PHO).forEach(function (r) {
    const slot = str_(r.Slot);
    if (slot) photos[slot] = {id: str_(r['File ID']), caption: str_(r.Caption), v: str_(r.Updated)};
  });
  const merch = table_(S.MRC).filter(function (r) { return r.Item && String(r.Active === '' ? 'Yes' : r.Active).toLowerCase() !== 'no'; })
    .map(function (r) { return {name: str_(r.Item), price: Number(r.Price) || 0, note: str_(r.Note)}; });
  const out = {ok: true, events: events, trips: trips, photos: photos, merch: merch,
    site: {zelle: str_(o.ZELLE_HANDLE), calendarId: str_(o.CALENDAR_ID)}};
  cache.put('content', JSON.stringify(out), 60);
  return out;
}

/** Upcoming events (next 180 days) from the club Google Calendar. Never throws: if the calendar can't be read, the site just uses the Events tab. */
function calendarEvents_(id) {
  if (!id) return [];
  try {
    let cal = CalendarApp.getCalendarById(id);
    if (!cal) { try { cal = CalendarApp.subscribeToCalendar(id); } catch (e) { cal = null; } }   // first run: add the shared calendar to this account
    if (!cal) return [];
    const now = new Date(), end = new Date(now.getTime() + 180 * 86400000);
    return cal.getEvents(now, end).slice(0, 80).map(function (ev) {
      const allDay = ev.isAllDayEvent();
      const st = ev.getStartTime(), en = ev.getEndTime();
      const last = allDay ? new Date(en.getTime() - 86400000) : en;
      const desc = String(ev.getDescription() || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      return {
        date: Utilities.formatDate(st, tz_(), 'yyyy-MM-dd'), end: Utilities.formatDate(last, tz_(), 'yyyy-MM-dd'),
        time: allDay ? '' : Utilities.formatDate(st, tz_(), 'h:mm a').toLowerCase(),
        title: clean_(ev.getTitle(), 120), type: 'Calendar', where: clean_(ev.getLocation(), 120), details: desc, link: '', show: true, cal: true
      };
    }).filter(function (e) { return e.title; });
  } catch (x) { console.error('calendar: ' + x); return []; }
}

function editKeyOk_(key) {
  const real = String(settings_().editKey || '');
  const k = String(key || '');
  if (!real || k.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ k.charCodeAt(i);
  return diff === 0;
}

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) { /* recreate */ } }
  const f = DriveApp.createFolder('Yale Outdoors site photos');
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  props.setProperty('PHOTO_FOLDER_ID', f.getId());
  return f;
}

/** Board login actions: check the key, replace a photo, or change a caption. */
function handleEditor_(p) {
  const c = CacheService.getScriptCache();
  const fails = Number(c.get('badkey') || 0);
  if (fails >= 20) return {ok: false, error: 'Too many wrong keys. Try again in an hour.'};
  if (!editKeyOk_(p.key)) {
    c.put('badkey', String(fails + 1), 3600);
    return {ok: false, error: 'That key is not right.'};
  }
  if (p.type === 'checkkey') return {ok: true};
  const slot = String(p.slot || '');
  if (!/^[a-z0-9-]{1,48}$/.test(slot)) return {ok: false, error: 'Bad photo slot.'};
  const caption = String(p.caption || '').slice(0, 200);
  const sh = sheet_(S.PHO);
  const rows = table_(S.PHO);
  const existing = rows.filter(function (r) { return str_(r.Slot) === slot; })[0];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (p.type === 'caption') {
      if (!existing) return {ok: false, error: 'Add a photo first.'};
      sh.getRange(existing._row, 3).setValue(safe_(caption));
    } else {
      const mime = String(p.mime || '');
      if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) return {ok: false, error: 'Use a JPEG, PNG or WebP picture.'};
      const bytes = Utilities.base64Decode(String(p.data || ''));
      if (!bytes.length || bytes.length > 4 * 1024 * 1024) return {ok: false, error: 'That picture is too large. Try one under 4 MB.'};
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const file = photoFolder_().createFile(Utilities.newBlob(bytes, mime, slot + '-' + Date.now() + '.' + ext));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      if (existing) {
        try { DriveApp.getFileById(str_(existing['File ID'])).setTrashed(true); } catch (x) { /* already gone */ }
        sh.getRange(existing._row, 1, 1, 4).setValues([[slot, file.getId(), safe_(caption || str_(existing.Caption)), new Date().toISOString()]]);
      } else {
        sh.appendRow([slot, file.getId(), safe_(caption), new Date().toISOString()]);
      }
    }
  } finally { lock.releaseLock(); }
  c.remove('content');
  return {ok: true};
}

/* ---------------------------------------------------------------- data helpers */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz_() { return ss_().getSpreadsheetTimeZone(); }

function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Missing "' + name + '" tab. Run setup() first.');
  return s;
}

function table_(name) {
  const v = sheet_(name).getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0];
  return v.slice(1).map(function (r, i) {
    const o = {_row: i + 2};
    h.forEach(function (k, j) { o[k] = r[j]; });
    return o;
  });
}

function colIndex_(headers, name) { return headers.indexOf(name) + 1; }

function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const m = String(v || '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function addDays_(s, n) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function eachDay_(a, b) { const out = []; for (let d = a; d <= b; d = addDays_(d, 1)) out.push(d); return out; }
function validDay_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00Z')); }
function round2_(n) { return Math.round(n * 100) / 100; }
function money_(n) { return '$' + round2_(n).toFixed(2).replace(/\.00$/, ''); }
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); }
function safe_(v) { const s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function esc_(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
function plural_(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function uniq_(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }

function settings_() {
  const o = {};
  sheet_(S.SET).getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; });
  const mm = o.MEMBER_MULTIPLIER;
  return {
    club: String(o.CLUB_EMAIL || '').trim(),
    gear: String(o.GEAR_MANAGER_EMAIL || '').trim(),
    extra: String(o.EXTRA_APPROVER_EMAILS || ''),
    grad: Number(o.GRAD_MULTIPLIER) || 2,
    member: (mm === '' || mm == null || isNaN(Number(mm))) ? 0.5 : Number(mm),
    pickup: String(o.PICKUP_NOTE || ''),
    editKey: String(o.EDIT_KEY || ''),
    merchPay: String(o.MERCH_PAYMENT || '')
  };
}

function boardEmails_() {
  const s = settings_();
  return uniq_([s.club, s.gear].concat(s.extra.split(',')).map(function (x) { return x.trim(); }));
}

function inventory_() {
  return table_(S.INV).filter(function (r) {
    return r.Item && String(r.Active === '' ? 'Yes' : r.Active).toLowerCase() !== 'no';
  }).map(function (r) {
    return {name: String(r.Item).trim(), owned: Number(r.Owned) || 0, deposit: Number(r.Deposit) || 0, rate: Number(r['Daily rate (Yale College)']) || 0};
  });
}

function memberVerified_(email) {
  const e = String(email).toLowerCase();
  return table_(S.MEM).some(function (r) { return String(r.Email).trim().toLowerCase() === e; });
}

/** Everything that takes gear out of circulation: manual adjustments plus approved or picked-up rentals. */
function blocked_() {
  const out = [];
  table_(S.ADJ).forEach(function (r) {
    if (!r.Item) return;
    const f = ymd_(r.From), t = ymd_(r.To) || f, q = Number(r['Quantity unavailable']) || 0;
    if (f && q > 0) out.push({item: String(r.Item).trim(), from: f, to: t < f ? f : t, qty: q, why: String(r.Reason || 'Adjustment')});
  });
  table_(S.REQ).forEach(function (r) {
    if (HOLD.indexOf(String(r.Status)) < 0) return;
    let lines = [];
    try { lines = JSON.parse(r['Lines (do not edit)'] || '[]'); } catch (e) { lines = []; }
    lines.forEach(function (l) { out.push({item: l.item, from: l.from, to: l.to, qty: l.qty, why: 'Request ' + r.ID}); });
  });
  return out;
}

/** How many of an item are free for every day from..to (owned minus the busiest day). */
function freeQty_(inv, blocked, item, from, to, extra) {
  const it = inv.filter(function (x) { return x.name === item; })[0];
  if (!it) return 0;
  const all = blocked.concat(extra || []);
  let worst = 0;
  eachDay_(from, to).forEach(function (d) {
    let used = 0;
    all.forEach(function (b) { if (b.item === item && b.from <= d && d <= b.to) used += b.qty; });
    if (used > worst) worst = used;
  });
  return Math.max(0, it.owned - worst);
}

function price_(inv, s, lines, school, applyMember) {
  const g = school === 'grad' ? s.grad : 1;
  const m = applyMember ? s.member : 1;
  let full = 0, dep = 0;
  lines.forEach(function (l) {
    const it = inv.filter(function (x) { return x.name === l.item; })[0];
    if (!it) return;
    full += it.rate * g * eachDay_(l.from, l.to).length * l.qty;
    dep += it.deposit * l.qty;
  });
  return {full: round2_(full), rent: round2_(full * m), deposit: round2_(dep), saving: round2_(full - full * m)};
}

function linesText_(lines) {
  return lines.map(function (l) {
    return '- ' + l.qty + ' x ' + l.item + ', ' + l.from + ' to ' + l.to + ' (' + plural_(eachDay_(l.from, l.to).length, 'day') + ')';
  }).join('\n');
}

function reviewUrl_(kind, id, token) {
  return ScriptApp.getService().getUrl() + '?action=review&kind=' + kind + '&id=' + encodeURIComponent(id) + '&t=' + token;
}

/* ---------------------------------------------------------------- email */

function send_(to, subject, text, html, replyTo) {
  if (!to) return;
  const opt = {to: to, subject: subject, body: text, name: 'Yale Outdoors'};
  if (html) opt.htmlBody = html;
  if (replyTo) opt.replyTo = replyTo;
  MailApp.sendEmail(opt);
}

function mailHtml_(heading, blocksHtml, url, label) {
  return '<div style="font-family:Arial,sans-serif;max-width:560px;color:#2A2119;line-height:1.5">' +
    '<h2 style="margin:0 0 12px;color:#1B3B30">' + esc_(heading) + '</h2>' + blocksHtml +
    (url ? '<p style="margin:22px 0"><a href="' + esc_(url) + '" style="background:#EF6A1E;color:#1E1409;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:bold">' + esc_(label) + '</a></p>' : '') +
    '<p style="color:#4A5B51;font-size:13px">Yale Outdoors</p></div>';
}

function pre_(text) { return '<pre style="font-family:inherit;white-space:pre-wrap;background:#EEF2EC;padding:12px;border-radius:4px;margin:0 0 12px">' + esc_(text) + '</pre>'; }

/* ---------------------------------------------------------------- gear requests */

function handleGear_(p) {
  const s = settings_();
  const inv = inventory_();
  const name = clean_(p.name, 80);
  const email = clean_(p.email, 120).toLowerCase();
  const school = p.school === 'grad' ? 'grad' : (p.school === 'college' ? 'college' : '');
  if (!name || !/^[^@\s]+@yale\.edu$/i.test(email)) return {ok: false, error: 'Enter your name and your Yale email (ending in @yale.edu).'};
  if (!school) return {ok: false, error: 'Choose your school so we can work out your price.'};
  if (!Array.isArray(p.lines) || !p.lines.length || p.lines.length > 12) return {ok: false, error: 'Add between 1 and 12 items.'};

  const t = today_();
  const lines = [];
  for (let i = 0; i < p.lines.length; i++) {
    const l = p.lines[i] || {};
    const item = clean_(l.item, 80), qty = parseInt(l.qty, 10), from = String(l.from || ''), to = String(l.to || '');
    if (!inv.some(function (x) { return x.name === item; })) return {ok: false, error: 'We could not find "' + item + '" in the gear room.'};
    if (!(qty >= 1 && qty <= 50)) return {ok: false, error: 'Check the quantity for ' + item + '.'};
    if (!validDay_(from) || !validDay_(to) || to < from) return {ok: false, error: 'Check the dates for ' + item + '. Return cannot be before pickup.'};
    if (from < t) return {ok: false, error: 'Pickup for ' + item + ' is in the past.'};
    if (eachDay_(from, to).length > 120) return {ok: false, error: 'Rentals longer than four months need to be arranged with the Gear Manager directly.'};
    lines.push({item: item, qty: qty, from: from, to: to});
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let id, token, row;
  try {
    const blocked = blocked_();
    const mine = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const free = freeQty_(inv, blocked, l.item, l.from, l.to, mine);
      if (l.qty > free) {
        CacheService.getScriptCache().remove('inv');
        return {ok: false, stale: true, error: free < 1
          ? l.item + ' is not available for ' + l.from + ' to ' + l.to + '.'
          : 'Only ' + free + ' ' + l.item + ' left for ' + l.from + ' to ' + l.to + '.'};
      }
      mine.push({item: l.item, from: l.from, to: l.to, qty: l.qty});
    }
    const claims = !!p.member;
    const verified = memberVerified_(email);
    const quote = price_(inv, s, lines, school, claims);
    id = 'GR-' + Utilities.formatDate(new Date(), tz_(), 'MMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
    token = Utilities.getUuid().replace(/-/g, '');
    const firsts = lines.map(function (l) { return l.from; }).sort();
    const lasts = lines.map(function (l) { return l.to; }).sort();
    const sh = sheet_(S.REQ);
    sh.appendRow([id, new Date(), 'Pending', safe_(name), email, SCHOOL_LABEL[school], claims ? 'Yes' : 'No', claims ? (verified ? 'Yes' : 'NOT FOUND') : '',
      safe_(linesText_(lines)), firsts[0], lasts[lasts.length - 1], quote.rent, quote.deposit, safe_(clean_(p.note, 1000)), '', '', token, JSON.stringify(lines)]);
  } finally {
    lock.releaseLock();
  }

  const claims = !!p.member, verified = memberVerified_(email);
  const quote = price_(inv, s, lines, school, claims);
  const note = clean_(p.note, 1000);
  const body = 'Name: ' + name + '\nEmail: ' + email + '\nSchool: ' + SCHOOL_LABEL[school] +
    '\nMember: ' + (claims ? (verified ? 'Yes, found in the member list' : 'Says yes, NOT in the member list. Check before approving.') : 'No') +
    '\n\nItems:\n' + linesText_(lines) + '\n\nEstimate shown to requester: ' + money_(quote.rent) + ' rental plus ' + money_(quote.deposit) + ' refundable deposit' +
    '\nNotes: ' + (note || 'None');
  const url = reviewUrl_('gear', id, token);
  const to = boardEmails_().join(',');
  send_(to, 'Gear request ' + id + ' from ' + name, body + '\n\nReview and approve or decline:\n' + url,
    mailHtml_('New gear request ' + id, pre_(body), url, 'Review request'), email);
  send_(email, 'We got your gear request (' + id + ')',
    'Hi ' + name + ',\n\nWe received your gear request.\n\n' + linesText_(lines) + '\n\nThe Gear Manager reviews every request. You will get an email when it is approved. Nothing is held for you until then.\n\nYale Outdoors',
    mailHtml_('We got your gear request', '<p>Hi ' + esc_(name) + ',</p><p>Here is what you asked for:</p>' + pre_(linesText_(lines)) +
      '<p>The Gear Manager reviews every request. You will get an email when it is approved. Nothing is held for you until then.</p>'), s.club || '');
  CacheService.getScriptCache().remove('inv');
  return {ok: true, id: id};
}

/* ---------------------------------------------------------------- suggestions and Winter School */

function handleSuggestion_(p) {
  const s = settings_();
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase();
  if (!name || !/^[^@\s]+@yale\.edu$/i.test(email)) return {ok: false, error: 'Enter your name and your Yale email (ending in @yale.edu).'};
  const idea = clean_(p.idea, 3000), where = clean_(p.where, 200), kind = clean_(p.kind, 60);
  if (idea.length < 15) return {ok: false, error: 'Tell us a bit more about the idea (at least a sentence or two).'};
  const school = SCHOOL_LABEL[p.school] || 'Other';
  const dates = (Array.isArray(p.dates) ? p.dates : []).slice(0, 5).filter(function (d) { return d && validDay_(String(d.from || '')); }).map(function (d) {
    return String(d.from) + (d.to && validDay_(String(d.to)) && d.to !== d.from ? ' to ' + d.to : '');
  });
  if (p.flexible) dates.push('Flexible on dates');
  const equipment = (Array.isArray(p.equipment) ? p.equipment : []).slice(0, 20).filter(function (x) { return x && parseInt(x.qty, 10) > 0; }).map(function (x) {
    return parseInt(x.qty, 10) + ' x ' + clean_(x.item, 60);
  });
  const tr = p.transport || {};
  const modes = (Array.isArray(tr.modes) ? tr.modes : []).slice(0, 8).map(function (m) { return clean_(m, 60); });
  const transport = (modes.join(', ') || 'Not specified') + (tr.drivers !== '' && tr.drivers != null ? '\nPeople who could drive: ' + clean_(tr.drivers, 10) : '') + (tr.details ? '\nDetails: ' + clean_(tr.details, 800) : '');
  const id = 'SG-' + Utilities.formatDate(new Date(), tz_(), 'MMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  const token = Utilities.getUuid().replace(/-/g, '');
  const f = {
    group: clean_(p.groupSize, 40), length: clean_(p.length, 60), exp: clean_(p.experience, 80), costs: clean_(p.costs, 600),
    lead: clean_(p.leading, 80), notes: clean_(p.notes, 1000), otherEq: clean_(p.equipmentOther, 600)
  };
  const eqAll = equipment.join(', ') + (f.otherEq ? (equipment.length ? '; ' : '') + 'Other: ' + f.otherEq : '');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_(S.SUG).appendRow([id, new Date(), 'New', safe_(name), email, school, safe_(kind), safe_(where), safe_(idea), safe_(dates.join('; ')), safe_(f.group), safe_(f.length), safe_(f.exp),
      safe_(eqAll || 'None listed'), safe_(transport), safe_(f.costs), safe_(f.lead), safe_(f.notes), '', '', token]);
  } finally { lock.releaseLock(); }

  const body = 'From: ' + name + ' (' + email + ', ' + school + ')\nKind: ' + kind + '\nWhere: ' + (where || 'Open') + '\n\nIdea:\n' + idea +
    '\n\nPossible dates: ' + (dates.join('; ') || 'None given') + '\nGroup size: ' + (f.group || 'Not given') + '\nLength: ' + (f.length || 'Not given') + '\nExperience needed: ' + (f.exp || 'Not given') +
    '\n\nEquipment from the gear room or elsewhere: ' + (eqAll || 'None listed') + '\n\nTransportation: ' + transport + '\nCosts, permits, reservations: ' + (f.costs || 'None given') +
    '\n\nWould lead it: ' + (f.lead || 'Not said') + '\nNotes: ' + (f.notes || 'None');
  const url = reviewUrl_('suggestion', id, token);
  send_(boardEmails_().join(','), 'Trip idea ' + id + ': ' + (where || kind), body + '\n\nReview:\n' + url, mailHtml_('New trip or event idea ' + id, pre_(body), url, 'Review idea'), email);
  send_(email, 'We got your idea (' + id + ')', 'Hi ' + name + ',\n\nThanks for the suggestion. The coordinators will look at it and reply to this email.\n\nYale Outdoors',
    mailHtml_('Thanks for the idea', '<p>Hi ' + esc_(name) + ',</p><p>The coordinators will look at your suggestion and reply to this email.</p>'), s.club || '');
  return {ok: true, id: id};
}

function handleWinter_(p) {
  const s = settings_();
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase();
  if (!name || !/^[^@\s]+@yale\.edu$/i.test(email)) return {ok: false, error: 'Enter your name and your Yale email (ending in @yale.edu).'};
  const wants = (Array.isArray(p.wants) ? p.wants : []).slice(0, 5).map(function (w) { return clean_(w, 60); }).join(', ');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_(S.WIN).appendRow([new Date(), safe_(name), email, SCHOOL_LABEL[p.school] || 'Other', safe_(wants), safe_(clean_(p.topics, 600)), safe_(clean_(p.experience, 600))]);
  } finally { lock.releaseLock(); }
  const body = 'Winter School interest\nName: ' + name + '\nEmail: ' + email + '\nSchool: ' + (SCHOOL_LABEL[p.school] || 'Other') + '\nInterested in: ' + (wants || 'Not said') +
    '\nTopics: ' + (clean_(p.topics, 600) || 'None') + '\nExperience: ' + (clean_(p.experience, 600) || 'None');
  send_(boardEmails_().join(','), 'Winter School interest: ' + name, body, mailHtml_('Winter School interest', pre_(body)), email);
  send_(email, 'You are on the Winter School list', 'Hi ' + name + ',\n\nThanks. We will email you when Winter School dates and sign-ups are set.\n\nYale Outdoors',
    mailHtml_('You are on the list', '<p>Hi ' + esc_(name) + ',</p><p>We will email you when Winter School dates and sign-ups are set.</p>'), s.club || '');
  return {ok: true};
}

/* ---------------------------------------------------------------- alumni updates and trip reports */

function handleAlumni_(p) {
  const s = settings_();
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return {ok: false, error: 'Enter your name and an email we can reach you at.'};
  const f = {year: clean_(p.classYear, 20), role: clean_(p.role, 120), note: clean_(p.note, 1500), fund: p.fundraising ? 'Yes' : 'No'};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_(S.ALU).appendRow([new Date(), safe_(name), email, safe_(f.year), safe_(f.role), safe_(f.note), f.fund]);
  } finally { lock.releaseLock(); }
  const body = 'Alumni update\nName: ' + name + '\nEmail: ' + email + '\nClass year: ' + (f.year || 'Not given') + '\nWith YO as: ' + (f.role || 'Not given') +
    '\nOkay to hear about alumni giving: ' + f.fund + '\n\nNote:\n' + (f.note || 'None');
  send_(s.club || '', 'Alumni update: ' + name, body, mailHtml_('Alumni update', pre_(body)), email);
  send_(email, 'Thank you from Yale Outdoors', 'Hi ' + name + ',\n\nThanks for getting in touch. You are on the alumni list.\n\nYale Outdoors',
    mailHtml_('Thank you', '<p>Hi ' + esc_(name) + ',</p><p>Thanks for getting in touch. You are on the alumni list.</p>'), s.club || '');
  return {ok: true};
}

function handleReport_(p) {
  const s = settings_();
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase();
  if (!name || !/^[^@\s]+@yale\.edu$/i.test(email)) return {ok: false, error: 'Enter your name and your Yale email (ending in @yale.edu).'};
  const dest = clean_(p.destination, 200), dates = clean_(p.dates, 120);
  if (!dest || !dates) return {ok: false, error: 'Add at least the destination and the dates.'};
  const f = {
    weather: clean_(p.weather, 300), leaders: clean_(p.leaders, 300), group: clean_(p.groupSize, 40), activity: clean_(p.activity, 120),
    transport: clean_(p.transport, 400), expenses: clean_(p.expenses, 400), route: clean_(p.route, 3000), maps: clean_(p.maps, 300),
    high: clean_(p.highlights, 2000), diff: clean_(p.difficulties, 2000), other: clean_(p.comments, 2000)
  };
  const id = 'TR-' + Utilities.formatDate(new Date(), tz_(), 'MMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_(S.RPT).appendRow([id, new Date(), safe_(name), email, safe_(dest), safe_(dates), safe_(f.weather), safe_(f.leaders), safe_(f.group), safe_(f.activity), safe_(f.transport),
      safe_(f.expenses), safe_(f.route), safe_(f.maps), safe_(f.high), safe_(f.diff), safe_(f.other)]);
  } finally { lock.releaseLock(); }
  const body = 'YALE OUTDOORS TRIP REPORT ' + id + '\n\nDestination: ' + dest + '\nDate(s): ' + dates + '\nWeather conditions: ' + f.weather + '\nLeaders: ' + f.leaders + '\nGroup size: ' + f.group +
    '\nActivity: ' + f.activity + '\nTransportation: ' + f.transport + '\nExpenses: ' + f.expenses + '\n\nRoute description / trail information:\n' + f.route + '\n\nMaps used: ' + f.maps +
    '\n\nHighlights:\n' + f.high + '\n\nDifficulties encountered:\n' + f.diff + '\n\nOther comments:\n' + f.other + '\n\nSubmitted by ' + name + ' (' + email + ')';
  send_(boardEmails_().join(','), 'Trip report ' + id + ': ' + dest, body, mailHtml_('Trip report ' + id, pre_(body)), email);
  send_(email, 'We got your trip report (' + id + ')', 'Hi ' + name + ',\n\nThank you for writing up ' + dest + '. It is filed as ' + id + '.\n\nYale Outdoors',
    mailHtml_('Thank you', '<p>Hi ' + esc_(name) + ',</p><p>Thank you for writing up ' + esc_(dest) + '. It is filed as ' + esc_(id) + '.</p>'), s.club || '');
  return {ok: true, id: id};
}

/* ---------------------------------------------------------------- merch orders */

function handleMerch_(p) {
  const s = settings_();
  const name = clean_(p.name, 80), email = clean_(p.email, 120).toLowerCase(), phone = clean_(p.phone, 30), year = clean_(p.year, 20);
  if (!name || !/^[^@\s]+@yale\.edu$/i.test(email)) return {ok: false, error: 'Enter your name and your Yale email (ending in @yale.edu).'};
  if (!phone) return {ok: false, error: 'Add a phone number so we can reach you about pickup.'};
  const catalog = {};
  table_(S.MRC).forEach(function (r) { if (r.Item && String(r.Active === '' ? 'Yes' : r.Active).toLowerCase() !== 'no') catalog[String(r.Item).trim().toLowerCase()] = Number(r.Price) || 0; });
  let total = 0;
  const lines = (Array.isArray(p.items) ? p.items : []).slice(0, 10).map(function (x) {
    const item = clean_(x && x.item, 80), key = item.toLowerCase(), qty = Math.max(1, Math.min(10, parseInt(x && x.qty, 10) || 1));
    if (!(key in catalog)) return null;
    total += catalog[key] * qty;
    return qty + ' x ' + item + (x.size ? ', size ' + clean_(x.size, 20) : '') + ' ($' + (catalog[key] * qty) + ')';
  }).filter(Boolean);
  if (!lines.length) return {ok: false, error: 'Choose at least one item.'};
  const pay = clean_(p.payment, 40), note = clean_(p.note, 600);
  const id = 'MR-' + Utilities.formatDate(new Date(), tz_(), 'MMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_(S.ORD).appendRow([id, new Date(), safe_(name), email, safe_(phone), safe_(year), safe_(lines.join('; ')), total, safe_(pay), safe_(note), 'No']);
  } finally { lock.releaseLock(); }
  const body = 'Merch order ' + id + '\nName: ' + name + '\nEmail: ' + email + '\nPhone: ' + phone + '\nYear: ' + (year || 'Not given') + '\n\nItems:\n' + lines.join('\n') +
    '\n\nTotal: $' + total + '\nPlans to pay by: ' + (pay || 'Not said') + '\nNote: ' + (note || 'None');
  send_(boardEmails_().join(','), 'Merch order ' + id + ': ' + name + ' ($' + total + ')', body, mailHtml_('Merch order ' + id, pre_(body)), email);
  const how = s.merchPay || 'We will email you about payment.';
  send_(email, 'We got your merch order (' + id + ')', 'Hi ' + name + ',\n\nThanks for your order:\n' + lines.join('\n') + '\n\nTotal: $' + total + '\nPlease pay: ' + how + '\n\nWe will email you when the items arrive and organize a pickup.\n\nYale Outdoors',
    mailHtml_('Thanks for your order', '<p>Hi ' + esc_(name) + ',</p><p>' + lines.map(esc_).join('<br>') + '</p><p><strong>Total: $' + total + '</strong></p><p>Please pay: ' + esc_(how) + '</p><p>We will email you when the items arrive and organize a pickup.</p>'), s.club || '');
  return {ok: true, id: id, total: total};
}

/* ---------------------------------------------------------------- review page and decisions */

function findRecord_(kind, id) {
  const name = kind === 'suggestion' ? S.SUG : S.REQ;
  const rows = table_(name).filter(function (r) { return r.ID === id; });
  return rows[0] || null;
}

function reviewPage_(kind, id, token) {
  const rec = findRecord_(kind, id);
  if (!rec || !token || rec.Token !== token) return page_('Link not valid', '<h1>This review link is not valid</h1><p>Open the most recent email about this request, or change the status on the Requests tab of the Sheet.</p>');
  const decided = (kind === 'suggestion' ? ['Interested', 'Scheduled', 'Not now'] : ['Approved', 'Declined', 'Picked up', 'Returned', 'Cancelled']).indexOf(String(rec.Status)) >= 0;
  let body;
  if (kind === 'suggestion') {
    body = '<h1>Idea ' + esc_(id) + '</h1><p class="meta">Status: ' + esc_(rec.Status) + '</p>' +
      '<dl><dt>From</dt><dd>' + esc_(rec.Name) + ' (' + esc_(rec.Email) + '), ' + esc_(rec.School) + '</dd>' +
      '<dt>Kind</dt><dd>' + esc_(rec.Kind) + '</dd><dt>Where</dt><dd>' + esc_(rec.Where) + '</dd><dt>Idea</dt><dd>' + esc_(rec.Idea) + '</dd>' +
      '<dt>Possible dates</dt><dd>' + esc_(rec['Possible dates']) + '</dd><dt>Group size</dt><dd>' + esc_(rec['Group size']) + '</dd>' +
      '<dt>Trip length</dt><dd>' + esc_(rec['Trip length']) + '</dd><dt>Experience</dt><dd>' + esc_(rec.Experience) + '</dd>' +
      '<dt>Equipment</dt><dd>' + esc_(rec.Equipment) + '</dd><dt>Transportation</dt><dd style="white-space:pre-wrap">' + esc_(rec.Transportation) + '</dd>' +
      '<dt>Costs and permits</dt><dd>' + esc_(rec['Costs and permits']) + '</dd><dt>Would lead it</dt><dd>' + esc_(rec.Leading) + '</dd><dt>Notes</dt><dd>' + esc_(rec.Notes) + '</dd></dl>';
    body += decided ? '<p class="done">Already marked ' + esc_(rec.Status) + '.</p>' :
      '<label>Note to ' + esc_(rec.Name) + ' (optional)<textarea id="note"></textarea></label>' +
      '<div class="row"><button class="go" onclick="decide(\'interested\')">Interested</button><button class="no" onclick="decide(\'notnow\')">Not right now</button></div>';
  } else {
    const inv = inventory_(), s = settings_();
    const lines = JSON.parse(rec['Lines (do not edit)'] || '[]');
    const school = rec.School === SCHOOL_LABEL.grad ? 'grad' : 'college';
    const blocked = blocked_();
    const verified = rec['Member verified'] === 'Yes';
    const claims = rec['Claims member'] === 'Yes';
    const withM = price_(inv, s, lines, school, true), without = price_(inv, s, lines, school, false);
    let rowsHtml = '';
    lines.forEach(function (l) {
      const free = freeQty_(inv, blocked, l.item, l.from, l.to, []);
      rowsHtml += '<tr><td>' + esc_(l.item) + '</td><td>' + l.qty + '</td><td>' + esc_(l.from) + ' to ' + esc_(l.to) + '</td><td class="' + (free < l.qty ? 'bad' : 'ok') + '">' + free + ' free</td></tr>';
    });
    body = '<h1>Gear request ' + esc_(id) + '</h1><p class="meta">Status: ' + esc_(rec.Status) + '</p>' +
      '<dl><dt>From</dt><dd>' + esc_(rec.Name) + ' (' + esc_(rec.Email) + ')</dd><dt>School</dt><dd>' + esc_(rec.School) + '</dd>' +
      '<dt>Member</dt><dd>' + (claims ? (verified ? '<span class="ok">Yes, in the member list</span>' : '<span class="bad">Says yes, but not in the member list</span>') : 'No') + '</dd>' +
      '<dt>Notes</dt><dd>' + esc_(rec.Note || 'None') + '</dd></dl>' +
      '<table><tr><th>Item</th><th>Qty</th><th>Dates</th><th>Available now</th></tr>' + rowsHtml + '</table>' +
      '<p>Rental: <b id="rent"></b>. Refundable deposit: <b>' + money_(withM.deposit) + '</b>.</p>';
    body += decided ? '<p class="done">Already marked ' + esc_(rec.Status) + (rec.Decided ? ' on ' + esc_(ymd_(rec.Decided)) : '') + '.</p>' :
      '<label class="chk"><input type="checkbox" id="mem"' + (verified ? ' checked' : '') + '> Apply the member rate</label>' +
      '<label>Note to ' + esc_(rec.Name) + ' (optional)<textarea id="note"></textarea></label>' +
      '<div class="row"><button class="go" onclick="decide(\'approve\',false)">Approve</button><button class="no" onclick="decide(\'decline\',false)">Decline</button></div>' +
      '<div id="force" style="display:none"><p class="bad" id="shortmsg"></p><button class="go" onclick="decide(\'approve\',true)">Approve anyway</button></div>';
    body += '<script>var PRICES=' + JSON.stringify({m: withM.rent, f: without.rent}).replace(/</g, '\\u003c') + ';' +
      'function showRent(){var c=document.getElementById("mem");var v=(c&&c.checked)?PRICES.m:PRICES.f;document.getElementById("rent").textContent="$"+v.toFixed(2).replace(/\\.00$/,"");}' +
      'showRent();var c0=document.getElementById("mem");if(c0)c0.addEventListener("change",showRent);</script>';
  }
  body += '<p id="msg" class="meta"></p>' +
    '<script>var KIND=' + JSON.stringify(kind).replace(/</g, '\\u003c') + ',ID=' + JSON.stringify(id).replace(/</g, '\\u003c') + ',TOKEN=' + JSON.stringify(token).replace(/</g, '\\u003c') + ';' +
    'function decide(d,force){var n=document.getElementById("note").value;var m=document.getElementById("mem");var msg=document.getElementById("msg");msg.textContent="Saving...";' +
    'google.script.run.withSuccessHandler(function(r){if(r.ok){document.querySelectorAll("button").forEach(function(b){b.disabled=true});msg.className="done";msg.textContent=r.message;}' +
    'else{msg.className="bad";msg.textContent=r.error;if(r.short){document.getElementById("force").style.display="block";document.getElementById("shortmsg").textContent=r.error;}}})' +
    '.withFailureHandler(function(e){msg.className="bad";msg.textContent="Something went wrong. Change the status on the Requests tab instead.";})' +
    '.decide(KIND,ID,TOKEN,d,n,m?m.checked:false,!!force);}</script>';
  return page_((kind === 'suggestion' ? 'Idea ' : 'Gear request ') + id, body);
}

function page_(title, body) {
  const css = 'body{font:16px/1.5 Arial,sans-serif;color:#2A2119;background:#EEF2EC;margin:0}main{max-width:640px;margin:0 auto;padding:24px 18px 60px}h1{color:#1B3B30;font-size:26px;margin:0 0 6px}' +
    '.meta{color:#4A5B51;margin:0 0 16px}dl{display:grid;grid-template-columns:120px 1fr;gap:6px 14px;margin:16px 0}dt{font-weight:bold}dd{margin:0}' +
    'table{border-collapse:collapse;width:100%;margin:10px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #C5CFC4}.ok{color:#2F6A2B;font-weight:bold}.bad{color:#B3261E;font-weight:bold}.done{color:#2F6A2B;font-weight:bold}' +
    'label{display:block;font-weight:bold;margin:14px 0}.chk{font-weight:normal}textarea{width:100%;min-height:80px;margin-top:6px;padding:10px;font:inherit;box-sizing:border-box}' +
    '.row{display:flex;gap:10px;margin-top:10px}button{font:bold 16px Arial;padding:12px 22px;border:0;border-radius:4px;cursor:pointer}.go{background:#1B3B30;color:#fff}.no{background:#fff;color:#2A2119;border:2px solid #2A2119}button:disabled{opacity:.4}';
  const html = '<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc_(title) + '</title><style>' + css + '</style></head><body><main>' + body + '</main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

/** Called by the Review page buttons. */
function decide(kind, id, token, decision, note, applyMember, force) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const rec = findRecord_(kind, id);
    if (!rec || !token || rec.Token !== token) return {ok: false, error: 'This review link is not valid.'};
    const s = settings_();
    note = clean_(note, 600);
    if (kind === 'suggestion') {
      const sh = sheet_(S.SUG), h = sh.getRange(1, 1, 1, SUG_COLS.length).getValues()[0];
      if (rec.Status !== 'New') return {ok: false, error: 'Already marked ' + rec.Status + '.'};
      const status = decision === 'interested' ? 'Interested' : 'Not now';
      sh.getRange(rec._row, colIndex_(h, 'Status')).setValue(status);
      sh.getRange(rec._row, colIndex_(h, 'Decision note')).setValue(safe_(note));
      sh.getRange(rec._row, colIndex_(h, 'Decided')).setValue(new Date());
      const msg = decision === 'interested'
        ? 'Thanks again for the idea about ' + (rec.Where || 'a trip') + '. We are interested. A coordinator will follow up to work out dates, gear and transportation.'
        : 'Thanks for the idea about ' + (rec.Where || 'a trip') + '. We cannot fit it in right now, but please keep the suggestions coming.';
      send_(rec.Email, 'About your idea (' + id + ')', 'Hi ' + rec.Name + ',\n\n' + msg + (note ? '\n\nNote from the coordinators: ' + note : '') + '\n\nYale Outdoors',
        mailHtml_('About your idea', '<p>Hi ' + esc_(rec.Name) + ',</p><p>' + esc_(msg) + '</p>' + (note ? '<p><b>Note from the coordinators:</b> ' + esc_(note) + '</p>' : '')), s.club || '');
      send_(s.club, 'Idea ' + id + ' marked ' + status, 'Idea ' + id + ' (' + (rec.Where || rec.Kind) + ') was marked ' + status + '.', null);
      return {ok: true, message: 'Saved as ' + status + '. We emailed ' + rec.Name + '.'};
    }
    return decideGear_(rec, decision, note, applyMember, force, s);
  } finally {
    lock.releaseLock();
  }
}

function decideGear_(rec, decision, note, applyMember, force, s) {
  if (rec.Status !== 'Pending') return {ok: false, error: 'Already marked ' + rec.Status + '.'};
  const sh = sheet_(S.REQ), h = sh.getRange(1, 1, 1, REQ_COLS.length).getValues()[0];
  const inv = inventory_();
  const lines = JSON.parse(rec['Lines (do not edit)'] || '[]');
  const school = rec.School === SCHOOL_LABEL.grad ? 'grad' : 'college';
  const set = function (col, v) { sh.getRange(rec._row, colIndex_(h, col)).setValue(v); };
  if (decision === 'approve') {
    const blocked = blocked_();
    const shorts = [];
    lines.forEach(function (l, i) {
      const free = freeQty_(inv, blocked, l.item, l.from, l.to, lines.slice(0, i));
      if (l.qty > free) shorts.push(l.item + ' (' + free + ' free for ' + l.from + ' to ' + l.to + ')');
    });
    if (shorts.length && !force) return {ok: false, short: true, error: 'Not enough stock: ' + shorts.join('; ') + '.'};
    const q = price_(inv, s, lines, school, !!applyMember);
    set('Status', 'Approved'); set('Rental total', q.rent); set('Deposit', q.deposit);
    set('Decision note', safe_(note)); set('Decided', new Date());
    const text = 'Hi ' + rec.Name + ',\n\nYour gear request ' + rec.ID + ' is approved.\n\n' + linesText_(lines) + '\n\nRental: ' + money_(q.rent) + (applyMember ? ' (member rate)' : '') +
      '\nRefundable deposit: ' + money_(q.deposit) + '\n\n' + s.pickup + (note ? '\n\nNote from the Gear Manager: ' + note : '') + '\n\nReturn gear clean, dry and working.\n\nYale Outdoors';
    send_(rec.Email, 'Your gear request is approved (' + rec.ID + ')', text, mailHtml_('Your gear request is approved', pre_(text.replace(/^Hi [^\n]*\n\n/, ''))), s.gear || s.club);
    send_(s.club, 'Gear request ' + rec.ID + ' approved', rec.Name + ' approved for:\n' + linesText_(lines), null);
    CacheService.getScriptCache().remove('inv');
    refreshTracker_();
    return {ok: true, message: 'Approved. ' + rec.Name + ' has been emailed and the stock tracker is updated.'};
  }
  set('Status', 'Declined'); set('Decision note', safe_(note)); set('Decided', new Date());
  const text = 'Hi ' + rec.Name + ',\n\nWe cannot approve gear request ' + rec.ID + ' as submitted.' + (note ? '\n\n' + note : '') + '\n\nReply to this email if you want to work out another option.\n\nYale Outdoors';
  send_(rec.Email, 'About your gear request (' + rec.ID + ')', text, mailHtml_('About your gear request', pre_(text.replace(/^Hi [^\n]*\n\n/, ''))), s.gear || s.club);
  return {ok: true, message: 'Declined. ' + rec.Name + ' has been emailed.'};
}

/* ---------------------------------------------------------------- tracker and triggers */

function refreshTracker_() {
  const inv = inventory_(), bl = blocked_(), sh = sheet_(S.TRK);
  sh.clear();
  const t = today_();
  const days = eachDay_(t, addDays_(t, 27));
  const head = ['Item', 'Owned'].concat(days.map(function (d) { return Utilities.formatDate(new Date(d + 'T12:00:00Z'), 'UTC', 'EEE M/d'); }));
  const data = inv.map(function (it) {
    return [it.name, it.owned].concat(days.map(function (d) { return freeQty_(inv, bl, it.name, d, d); }));
  });
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (data.length) {
    sh.getRange(2, 1, data.length, head.length).setValues(data);
    const range = sh.getRange(2, 3, data.length, days.length);
    const rule = SpreadsheetApp.newConditionalFormatRule().whenNumberEqualTo(0).setBackground('#F4C7C3').setRanges([range]).build();
    sh.setConditionalFormatRules([rule]);
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.getRange(data.length + 3, 1).setValue('Free units per day. Red means none left. This tab rebuilds itself when stock, adjustments or requests change.');
}

function dailyRefresh() {
  CacheService.getScriptCache().remove('inv');
  refreshTracker_();
}

/** Installed by setup(). Sends emails when a Status is changed by hand, and keeps the tracker fresh. */
function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet(), name = sh.getName();
  if ([S.INV, S.ADJ, S.REQ, S.MEM].indexOf(name) < 0) return;
  try {
    if (name === S.REQ && e.range.getRow() > 1 && e.range.getColumn() === colIndex_(REQ_COLS, 'Status')) {
      const val = String(e.value || '');
      const row = e.range.getRow();
      const rec = table_(S.REQ).filter(function (r) { return r._row === row; })[0];
      if (rec && !rec.Decided && (val === 'Approved' || val === 'Declined')) {
        const s = settings_(), inv = inventory_();
        const lines = JSON.parse(rec['Lines (do not edit)'] || '[]');
        const school = rec.School === SCHOOL_LABEL.grad ? 'grad' : 'college';
        const verified = memberVerified_(rec.Email);
        const q = price_(inv, s, lines, school, verified && rec['Claims member'] === 'Yes');
        const getCol = function (n) { return colIndex_(REQ_COLS, n); };
        sh.getRange(row, getCol('Decided')).setValue(new Date());
        if (val === 'Approved') {
          sh.getRange(row, getCol('Rental total')).setValue(q.rent);
          const text = 'Hi ' + rec.Name + ',\n\nYour gear request ' + rec.ID + ' is approved.\n\n' + linesText_(lines) + '\n\nRental: ' + money_(q.rent) + '\nRefundable deposit: ' + money_(q.deposit) + '\n\n' + s.pickup + '\n\nReturn gear clean, dry and working.\n\nYale Outdoors';
          send_(rec.Email, 'Your gear request is approved (' + rec.ID + ')', text, null, s.gear || s.club);
        } else {
          send_(rec.Email, 'About your gear request (' + rec.ID + ')', 'Hi ' + rec.Name + ',\n\nWe cannot approve gear request ' + rec.ID + ' as submitted. Reply to this email if you want to work out another option.\n\nYale Outdoors', null, s.gear || s.club);
        }
      }
    }
    CacheService.getScriptCache().remove('inv');
    refreshTracker_();
  } catch (err) {
    console.error(err);
  }
}
