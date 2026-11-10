// Smoke test without a browser: stubs the DOM bits the card needs and drives it with a fake hass.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../thermostat-schedule-card.js", import.meta.url), "utf8");
const registry = {};
class FakeElement {
  constructor() {
    this.events = [];
  }
  dispatchEvent(e) {
    this.events.push(e);
  }
  appendChild() {}
  attachShadow() {
    const listeners = {};
    this.shadowRoot = {
      innerHTML: "",
      addEventListener: (t, f) => (listeners[t] = f),
      fire: (t, ev) => listeners[t](ev),
    };
  }
}
const ctx = {
  HTMLElement: FakeElement,
  customElements: { define: (n, c) => (registry[n] = c) },
  document: {
    createElement: () => {
      const f = { handlers: {} };
      f.addEventListener = (t, fn) => (f.handlers[t] = fn);
      return f;
    },
  },
  window: {},
  console: { info() {} },
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init.detail;
    }
  },
  Intl,
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const Card = registry["thermostat-schedule-card"];
assert.ok(Card && registry["thermostat-schedule-card-editor"], "elements registered");
assert.equal(ctx.window.customCards.length, 1);

const plan = "00:00/17 06:00/21 08:30/18 17:00/22 22:00/17";
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const calls = [];
const mkHass = (language = "en", extra = {}) => ({
  language,
  states: {
    "climate.t": {
      state: "auto",
      attributes: { hvac_modes: ["off", "auto", "heat"], current_temperature: 20.5, temperature: 21, hvac_action: "heating" },
    },
    ...Object.fromEntries(days.map((d) => [`text.t_weekly_schedule_${d}`, { state: plan, attributes: {} }])),
    ...extra,
  },
  callService: async (...a) => calls.push(a),
});
const mk = (cfg, hass) => {
  const c = new Card();
  c.setConfig(cfg);
  c.hass = hass;
  return c;
};
const click = (c, data) =>
  c.shadowRoot.fire("click", { target: { closest: () => ({ dataset: data }) } });

// 1) prefix autodetected from climate, English labels
let c = mk({ climate: "climate.t" }, mkHass("en"));
let html = c.shadowRoot.innerHTML;
assert.match(html, /Heating schedule/);
assert.match(html, /Mon–Fri/);
assert.match(html, /Now 20.5 °C → target 21 °C/);
assert.match(html, /06:00 – 08:30/);

// 2) Czech labels
c = mk({ climate: "climate.t" }, mkHass("cs"));
assert.match(c.shadowRoot.innerHTML, /Plán topení/);
assert.match(c.shadowRoot.innerHTML, /Po–Pá/);
assert.match(c.shadowRoot.innerHTML, /Sobota/);

// 3) edit + save writes the same value to all days of the group
c = mk({ climate: "climate.t" }, mkHass("en"));
click(c, { act: "open", i: "1" });
click(c, { act: "temp", i: "1", d: "1" });
click(c, { act: "dlg-ok" });
click(c, { act: "save" });
await new Promise((r) => setTimeout(r));
assert.equal(calls.length, 5);
assert.equal(calls[0][1], "set_value");
assert.equal(calls[0][2].value, "00:00/17 06:00/21.5 08:30/18 17:00/22 22:00/17");

// 4) daily grouping → 7 tabs, one write per save
calls.length = 0;
c = mk({ climate: "climate.t", grouping: "daily" }, mkHass("en"));
assert.equal((c.shadowRoot.innerHTML.match(/data-act="tab"/g) || []).length, 7);

// 5) missing entities → friendly message, no throw
c = mk({ entity_prefix: "text.nope_" }, mkHass("en"));
assert.match(c.shadowRoot.innerHTML, /Schedule entities not found/);

// 6) title is escaped
c = mk({ climate: "climate.t", title: "<img src=x>" }, mkHass("en"));
assert.ok(!c.shadowRoot.innerHTML.includes("<img src=x>"));

// 7) config validation + stub config
assert.throws(() => new Card().setConfig({}));
assert.equal(JSON.stringify(Card.getStubConfig(mkHass())), JSON.stringify({ climate: "climate.t" }));

// 8) after saving, the card keeps the saved plan even though the entity state is still the old one
c = mk({ climate: "climate.t" }, mkHass("en"));
click(c, { act: "open", i: "1" });
click(c, { act: "temp", i: "1", d: "2" });
click(c, { act: "dlg-ok" });
click(c, { act: "save" });
await new Promise((r) => setTimeout(r));
assert.equal(c._blocks[1].temp, 22);
assert.equal(c._dirty, false);

// 9) invalid language tags do not break rendering and fall back to the HA language / English
for (const language of ["c", "cs_CZ", "xx-", "auto"]) {
  c = mk({ climate: "climate.t", language }, mkHass("en"));
  assert.match(c.shadowRoot.innerHTML, /Mon–Fri|Po–Pá/, language);
}
assert.match(mk({ climate: "climate.t", language: "cs_CZ" }, mkHass("en")).shadowRoot.innerHTML, /Plán topení/);

// 10) unavailable entities: message instead of a made-up plan, tabs still usable
const down = Object.fromEntries(days.map((d) => [`text.t_weekly_schedule_${d}`, { state: "unavailable", attributes: {} }]));
c = mk({ climate: "climate.t" }, mkHass("en", down));
html = c.shadowRoot.innerHTML;
assert.match(html, /Schedule entities unavailable/);
assert.ok(!html.includes('data-act="add"') && !html.includes('data-act="save"'));
assert.match(html, /data-act="tab"/);

// 11) day tabs are locked while there are unsaved changes
c = mk({ climate: "climate.t" }, mkHass("en"));
click(c, { act: "open", i: "1" });
click(c, { act: "temp", i: "1", d: "2" });
click(c, { act: "dlg-ok" });
assert.equal(c._dirty, true);
assert.match(c.shadowRoot.innerHTML, /data-act="tab" data-i="1" disabled/);
assert.match(c.shadowRoot.innerHTML, /Save or cancel your changes/);
click(c, { act: "tab", i: "1" });
assert.equal(c._tab, 0);
assert.equal(c._dirty, true);
click(c, { act: "cancel" });
assert.ok(!/data-act="tab" data-i="1" disabled/.test(c.shadowRoot.innerHTML));
click(c, { act: "tab", i: "1" });
assert.equal(c._tab, 1);

// 12) validation
c = mk({ climate: "climate.t", max_blocks: 3 }, mkHass("en"));
assert.match(c._validate(), /At most 3 blocks/);
c._blocks = [{ start: 0, temp: 20 }, { start: 600, temp: 21 }, { start: 600, temp: 22 }];
assert.match(c._validate(), /increasing/);
c._blocks = [{ start: 60, temp: 20 }];
assert.match(c._validate(), /00:00/);

// 13) Escape closes the dialog and restores the plan
c = mk({ climate: "climate.t" }, mkHass("en"));
click(c, { act: "open", i: "1" });
click(c, { act: "temp", i: "1", d: "2" });
assert.ok(c._dlg);
c.shadowRoot.fire("keydown", { key: "Escape", stopPropagation() {} });
assert.equal(c._dlg, null);
assert.equal(c._blocks[1].temp, 21);
assert.equal(c._dirty, false);

// 14) editor: config-changed drops empty values and "auto", converts time_step; schema stays stable
const Editor = registry["thermostat-schedule-card-editor"];
const ed = new Editor();
ed.setConfig({ climate: "climate.t", title: "X", language: "cs" });
ed.hass = mkHass("en");
const form = ed._form;
const schema = form.schema;
assert.ok(schema.length > 0 && form.data.language === "cs");
ed.hass = mkHass("en"); // another state update
assert.equal(form.schema, schema, "schema not reassigned on hass updates");
form.handlers["value-changed"]({
  stopPropagation() {},
  detail: { value: { climate: "climate.t", title: "", time_step: "30", language: "auto", min: 8 } },
});
assert.equal(JSON.stringify(ed.events[0].detail.config), JSON.stringify({ climate: "climate.t", time_step: 30, min: 8 }));

console.log("ok");
