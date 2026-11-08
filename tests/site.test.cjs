const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the real script with a small DOM fixture. Network requests are always stubbed.
function app(nodes = {}) {
  const document = {
    querySelector: selector => nodes[selector] || null,
    querySelectorAll: selector => nodes[selector] || [],
    getElementById: id => nodes['#' + id] || null,
    createElement: () => ({ innerHTML: '', className: '' }),
    addEventListener() {},
  };
  const context = vm.createContext({
    document, window: { YO: { GEAR: [] } }, console, setTimeout,
    fetch() { throw new Error('Unexpected network request in test'); },
  });
  const source = fs.readFileSync('site/site.js', 'utf8').replace(
    '/* ---------- start ---------- */',
    `globalThis.subject = {
      nDays, free, calc, buildEq, addDateRow, deliver, loadInventory,
      configure: function(gear, requests, blocked) { Y.GEAR=gear; lines=requests||[]; BLOCKED=blocked||[]; },
      dateRows: function(rows) { dateRows=rows; },
      api: function(url) { Y.API_URL=url; }
    };
    /* ---------- start ---------- */`
  );
  vm.runInContext(source, context);
  return { subject: context.subject, nodes, context };
}

function control(attributes = {}) {
  return {
    attributes, listeners: {},
    addEventListener(name, listener) { this.listeners[name] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    focus() { this.focused = true; },
  };
}

test('rental day counts are inclusive across daylight saving and beyond the old 400-day cap', () => {
  const { subject } = app();
  assert.equal(subject.nDays('2026-03-07', '2026-03-09'), 3);
  assert.equal(subject.nDays('2026-10-31', '2026-11-02'), 3);
  assert.equal(subject.nDays('2026-01-01', '2027-12-31'), 730);
  assert.equal(subject.nDays('2026-11-10', '2026-11-08'), 0);
  assert.equal(subject.nDays('', '2026-11-08'), 0);
});

test('availability counts the busiest overlapping day, including other lines in the same request', () => {
  const { subject } = app();
  subject.configure([{ name: 'Tent', owned: 5 }], [
    { id: 1, item: 'Tent', qty: 2, from: '2027-01-01', to: '2027-01-03' },
  ], [
    { item: 'Tent', qty: 1, from: '2027-01-01', to: '2027-01-01' },
    { item: 'Tent', qty: 2, from: '2027-01-03', to: '2027-01-04' },
  ]);
  assert.equal(subject.free('Tent', '2027-01-01', '2027-01-04', -1), 1);
  assert.equal(subject.free('Tent', '2027-01-01', '2027-01-04', 1), 3);
  assert.equal(subject.free('Tent', '2027-01-05', '2027-01-05', -1), 5);
});

test('quotes reject invalid quantities and overlong rentals; membership and deposits stay correct', () => {
  const { subject, nodes } = app();
  nodes['#gSchool'] = { value: 'grad' };
  nodes['#gMember'] = { checked: true };
  nodes['#sum'] = {};
  nodes['#c1'] = {};
  const gear = [{ name: 'Tent', owned: 5, rate: 7, deposit: 30 }];
  const line = { id: 1, item: 'Tent', qty: 2, from: '2099-01-01', to: '2099-01-03' };
  subject.configure(gear, [line]);
  const result = subject.calc();
  assert.equal(result.ok, true);
  assert.equal(result.rent, 42); // 3 days × 2 tents × $7 × graduate 2 × member 0.5
  assert.equal(result.dep, 60);
  line.qty = 0;
  assert.equal(subject.calc().ok, false);
  line.qty = 1.5;
  assert.equal(subject.calc().ok, false);
  line.qty = 1;
  line.to = '2099-06-01';
  assert.equal(subject.calc().ok, false);
  assert.match(nodes['#c1'].textContent, /four months/);
});

test('removing and re-adding a date option keeps every label/input ID unique', () => {
  const { subject } = app();
  const rows = {
    children: [],
    querySelectorAll() { return this.children; },
    appendChild(row) { this.children.push(row); },
  };
  subject.dateRows(rows);
  subject.addDateRow(); subject.addDateRow(); subject.addDateRow();
  rows.children.splice(1, 1);
  subject.addDateRow();
  const ids = rows.children.flatMap(row => [...row.innerHTML.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  assert.equal(new Set(ids).size, 6);
  subject.addDateRow(); subject.addDateRow();
  assert.equal(rows.children.length, 4);
});

test('inventory refresh preserves selected equipment quantities by item name', () => {
  const { subject, nodes } = app();
  const grid = { querySelectorAll: () => [{ dataset: { item: 'Tent' }, value: '3' }], innerHTML: '' };
  nodes['#eqGrid'] = grid;
  subject.configure([{ name: 'Daypack' }, { name: 'Tent' }]);
  subject.buildEq();
  assert.match(grid.innerHTML, /value="3"[^>]+data-item="Tent"/);
  assert.match(grid.innerHTML, /value="0"[^>]+data-item="Daypack"/);
});

test('an empty live inventory replaces stale defaults', async () => {
  const { subject, context } = app();
  subject.configure([{ name: 'Tent', owned: 5 }]);
  subject.api('https://example.test');
  context.fetch = async () => ({ json: async () => ({ ok: true, items: [], blocked: [] }) });
  subject.loadInventory();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(subject.free('Tent', '2027-01-01', '2027-01-01', -1), 0);
});

test('repeated submits send one request and unlock the form when it finishes', async () => {
  const { subject, context } = app();
  let resolveRequest, count = 0;
  context.fetch = () => { count++; return new Promise(resolve => { resolveRequest = resolve; }); };
  subject.api('https://example.test');
  const button = { disabled: false };
  const host = { dataset: {}, closest: () => ({ querySelectorAll: () => [button] }) };
  const send = () => subject.deliver(host, {}, {}, '', () => '<h3>Received</h3>');
  send(); send();
  assert.equal(count, 1);
  assert.equal(button.disabled, true);
  resolveRequest({ json: async () => ({ ok: true }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(button.disabled, false);
  assert.equal(host.dataset.sending, undefined);
  assert.match(host.innerHTML, /Received/);
});

test('expedition tabs support click, arrow-key wrapping, Home, and End', () => {
  const names = ['october', 'winter', 'spring'];
  const tabs = names.map(name => control({ 'aria-controls': 'panel-' + name }));
  const nodes = { '[role="tablist"]': [{ querySelectorAll: () => tabs }] };
  names.forEach(name => { nodes['#panel-' + name] = { hidden: name !== 'october' }; });
  app(nodes);
  tabs[1].listeners.click();
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
  assert.equal(nodes['#panel-winter'].hidden, false);
  assert.equal(nodes['#panel-october'].hidden, true);
  const key = (index, name) => tabs[index].listeners.keydown({ key: name, preventDefault() {} });
  key(1, 'End');
  assert.equal(tabs[2].focused, true);
  key(2, 'ArrowRight');
  assert.equal(tabs[0].attributes['aria-selected'], 'true');
  key(0, 'ArrowLeft');
  assert.equal(tabs[2].attributes['aria-selected'], 'true');
  key(2, 'Home');
  assert.equal(tabs[0].tabIndex, 0);
  assert.equal(tabs[1].tabIndex, -1);
});

test('linked cards reveal details on keyboard focus and close with Escape or blur', () => {
  const link = control(), front = control(), back = control();
  const parts = { '.card-go': link, '.card-front': front, '.card-back': back };
  const card = control();
  card.querySelector = selector => parts[selector];
  card.classList = { toggle(name, value) { card.flipped = value; } };
  app({ '.trail-card': [card] });
  assert.equal(back.attributes['aria-hidden'], 'true');
  link.listeners.focus();
  assert.equal(card.flipped, true);
  assert.equal(front.attributes['aria-hidden'], 'true');
  card.listeners.keydown({ key: 'Escape' });
  assert.equal(card.flipped, false);
  link.listeners.focus();
  link.listeners.blur();
  assert.equal(card.flipped, false);
});
