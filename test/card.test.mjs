// Smoke test without a browser: stubs the DOM bits the card needs and drives it with a fake hass.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../thermostat-schedule-card.js", import.meta.url), "utf8");
const registry = {};
class FakeElement {
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
  document: { createElement: () => ({ addEventListener() {} }) },
  window: {},
  console: { info() {} },
  CustomEvent: class {},
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

console.log("ok");
