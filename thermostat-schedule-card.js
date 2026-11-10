/*
 * thermostat-schedule-card
 * Weekly schedule editor for Zigbee2MQTT thermostats that expose the schedule as
 * text entities (e.g. Sonoff WGZBA): text.<prefix><day> = "HH:MM/°C HH:MM/°C ..."
 *
 * https://github.com/myreczek/thermostat-schedule-card
 */

const VERSION = "1.0.1";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY = 24 * 60;

const STRINGS = {
  en: {
    default_title: "Heating schedule",
    mode_off: "Off",
    mode_auto: "Auto",
    mode_heat: "Heat",
    now_target: (cur, tgt) => `Now ${cur} °C → target ${tgt} °C`,
    act_heating: "Heating",
    act_preheating: "Preheating",
    act_idle: "Idle",
    act_off: "Off",
    not_auto: "Mode is not Auto – the schedule will not apply.",
    differs: "Days in this group have different schedules – the first one is shown, saving will unify them.",
    every_day: "Every day",
    add_block: "Add block",
    cancel: "Cancel",
    save: "Save",
    done: "Done",
    delete: "Delete",
    settings: "Settings",
    settings_title: "Panel settings",
    new_block: "New block",
    edit_block: "Edit block",
    start: "Start",
    end: "End",
    temperature: "Temperature",
    first_starts: "The first block always starts at 00:00.",
    last_ends: "The last block ends at midnight.",
    lower: "Lower",
    higher: "Higher",
    darker: "Dimmer",
    brighter: "Brighter",
    radar: "Presence detection",
    radar_on: "On",
    radar_off: "Off",
    sensitivity: "Sensitivity",
    brightness: "Panel brightness (active)",
    err_first: "The first block must start at 00:00.",
    err_max: (n) => `At most ${n} blocks.`,
    err_order: "Times must be increasing.",
    err_save: (m) => `Saving failed: ${m}`,
    missing: (list) => `Schedule entities not found: ${list}`,
    need_config: "Set climate or entity_prefix.",
    unavailable: (list) => `Schedule entities unavailable: ${list}`,
    save_first: "Save or cancel your changes before switching days.",
    ed_climate: "Thermostat (climate entity)",
    ed_title: "Title",
    ed_prefix: "Schedule entity prefix (autodetected from the thermostat when empty)",
    ed_grouping: "Day grouping",
    ed_group_workdays: "Weekdays / Saturday / Sunday",
    ed_group_daily: "Every day separately",
    ed_group_all: "All days together",
    ed_advanced: "Advanced",
    ed_min: "Minimum temperature",
    ed_max: "Maximum temperature",
    ed_step: "Temperature step",
    ed_time_step: "Time step (minutes)",
    ed_max_blocks: "Maximum blocks per day",
    ed_language: "Language",
    ed_auto: "Automatic (Home Assistant language)",
    ed_radar: "Presence detection switch",
    ed_sens: "Sensitivity select",
    ed_bri: "Brightness number",
  },
  cs: {
    default_title: "Plán topení",
    mode_off: "Vypnuto",
    mode_auto: "Auto",
    mode_heat: "Topit",
    now_target: (cur, tgt) => `Teď ${cur} °C → cíl ${tgt} °C`,
    act_heating: "Topí",
    act_preheating: "Předehřívá",
    act_idle: "Netopí",
    act_off: "Vypnuto",
    not_auto: "Režim není Auto – plán se neuplatní.",
    differs: "Dny ve skupině mají různý plán – zobrazen je první, uložením se sjednotí.",
    every_day: "Každý den",
    add_block: "Přidat blok",
    cancel: "Zrušit",
    save: "Uložit",
    done: "Hotovo",
    delete: "Smazat",
    settings: "Nastavení",
    settings_title: "Nastavení panelu",
    new_block: "Nový blok",
    edit_block: "Upravit blok",
    start: "Začátek",
    end: "Konec",
    temperature: "Teplota",
    first_starts: "První blok vždy začíná v 00:00.",
    last_ends: "Poslední blok končí o půlnoci.",
    lower: "Nižší",
    higher: "Vyšší",
    darker: "Tmavší",
    brighter: "Světlejší",
    radar: "Detekce přítomnosti",
    radar_on: "Zapnuto",
    radar_off: "Vypnuto",
    sensitivity: "Citlivost",
    brightness: "Jas panelu (aktivní)",
    err_first: "První blok musí začínat v 00:00.",
    err_max: (n) => `Nejvýše ${n} bloků.`,
    err_order: "Časy musí růst.",
    err_save: (m) => `Uložení selhalo: ${m}`,
    missing: (list) => `Entity plánu nenalezeny: ${list}`,
    need_config: "Nastav climate nebo entity_prefix.",
    unavailable: (list) => `Entity plánu nejsou dostupné: ${list}`,
    save_first: "Před přepnutím dne změny ulož nebo zruš.",
    ed_climate: "Termostat (entita climate)",
    ed_title: "Název",
    ed_prefix: "Prefix entit plánu (při prázdném se odvodí z termostatu)",
    ed_grouping: "Seskupení dnů",
    ed_group_workdays: "Po–Pá / Sobota / Neděle",
    ed_group_daily: "Každý den zvlášť",
    ed_group_all: "Všechny dny dohromady",
    ed_advanced: "Pokročilé",
    ed_min: "Minimální teplota",
    ed_max: "Maximální teplota",
    ed_step: "Krok teploty",
    ed_time_step: "Krok času (minuty)",
    ed_max_blocks: "Nejvíce bloků za den",
    ed_language: "Jazyk",
    ed_auto: "Automaticky (jazyk Home Assistantu)",
    ed_radar: "Přepínač detekce přítomnosti",
    ed_sens: "Výběr citlivosti",
    ed_bri: "Číslo jasu",
  },
};

const SENS_LABELS = {
  en: { low: "Low", medium: "Medium", high: "High" },
  cs: { low: "Nízká", medium: "Střední", high: "Vysoká" },
};

// first valid language tag wins; an invalid one (typo in the config) must not break rendering
const langOf = (hass, cfg) => {
  for (const cand of [cfg?.language, hass?.locale?.language, hass?.language]) {
    if (!cand || cand === "auto") continue;
    try {
      const tag = Intl.getCanonicalLocales(String(cand).replace("_", "-"))[0];
      if (tag) return tag.split("-")[0].toLowerCase();
    } catch {
      // invalid tag, try the next candidate
    }
  }
  return "en";
};

const makeT = (lang) => (key, ...args) => {
  const v = (STRINGS[lang] || STRINGS.en)[key] ?? STRINGS.en[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const cap = (s, lang) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);

function weekday(lang, i, style) {
  try {
    const s = new Intl.DateTimeFormat(lang, { weekday: style, timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + i)) // 2024-01-01 is a Monday
    );
    return cap(s.replace(/\.$/, ""), lang);
  } catch {
    return cap(DAYS[i], "en");
  }
}

function makeGroups(mode) {
  const g = (idx) => ({ idx, days: idx.map((i) => DAYS[i]) });
  if (mode === "daily") return DAYS.map((_, i) => g([i]));
  if (mode === "all") return [g([0, 1, 2, 3, 4, 5, 6])];
  return [g([0, 1, 2, 3, 4]), g([5]), g([6])];
}

const fmtTime = (m) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtEnd = (m) => (m >= DAY ? "24:00" : fmtTime(m));
const fmtTemp = (t, lang = "en") =>
  Number.isFinite(t) ? t.toLocaleString(lang, { maximumFractionDigits: 1 }) : "–";

function parse(text) {
  const out = [];
  let last = -1;
  for (const part of String(text || "").trim().split(/\s+/)) {
    const m = part.match(/^(\d{1,2}):(\d{2})\/(-?\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    if (start <= last) continue; // drops repeated (padding) entries
    out.push({ start, temp: Number(m[3]) });
    last = start;
  }
  if (out.length) out[0].start = 0;
  return out;
}

const serialize = (blocks) => blocks.map((b) => `${fmtTime(b.start)}/${b.temp}`).join(" ");

// 16 °C blue → 24 °C orange (configurable via cold / warm)
function color(t, cold = 16, warm = 24) {
  const k = Math.max(0, Math.min(1, (t - cold) / Math.max(1, warm - cold)));
  return `hsl(${210 - k * 180}, 70%, ${52 - k * 4}%)`;
}

// climate.foo → text.foo_weekly_schedule_
const prefixFromClimate = (climate) => {
  const p = String(climate || "").split(".")[1];
  return p ? `text.${p}_weekly_schedule_` : null;
};

class ThermostatScheduleCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("thermostat-schedule-card-editor");
  }

  static getStubConfig(hass) {
    const states = (hass && hass.states) || {};
    for (const id of Object.keys(states)) {
      if (!id.startsWith("climate.")) continue;
      const prefix = prefixFromClimate(id);
      if (states[prefix + "monday"]) return { climate: id };
    }
    return { climate: "" };
  }

  setConfig(config) {
    if (!config || (!config.entity_prefix && !config.climate)) {
      throw new Error("Set climate or entity_prefix.");
    }
    const timeStep = Number(config.time_step);
    this._cfg = {
      min: 5,
      max: 30,
      step: 0.5,
      max_blocks: 12,
      grouping: "workdays",
      cold: 16,
      warm: 24,
      ...config,
      time_step: timeStep >= 1 && timeStep <= 60 && 60 % timeStep === 0 ? timeStep : 15,
    };
    this._prefix = this._cfg.entity_prefix || prefixFromClimate(this._cfg.climate);
    this._groups = makeGroups(this._cfg.grouping);
    this._tab = 0;
    this._blocks = null; // plan of the active tab being edited
    this._dirty = false;
    this._error = "";
    this._dlg = null; // {i, isNew, snap, dirtyBefore}
    this._settings = false;
    this._opt = {}; // optimistically written values until the state arrives from HA
    this._sig = null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
      this.shadowRoot.addEventListener("keydown", (e) => this._onKey(e));
    }
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    this._lang = langOf(hass, this._cfg);
    this._t = makeT(this._lang);
    // hass arrives on every change of any entity; redraw only when ours changed,
    // otherwise buttons get replaced between press and release and the click is lost
    const clim = this._cfg.climate && hass.states[this._cfg.climate];
    const sig = JSON.stringify([
      this._lang,
      this._groups.flatMap((g) => g.days).map((d) => this._entity(d)?.state),
      clim && [
        clim.state,
        clim.attributes.current_temperature,
        clim.attributes.temperature,
        clim.attributes.hvac_action,
      ],
      ["radar", "sens", "bri"].map((n) => hass.states[this._ent(n)]?.state),
    ]);
    if (sig === this._sig && this._blocks) return;
    this._sig = sig;
    this._opt = {};
    if (!this._dirty && !this._dlg) this._load();
    this._render();
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _ent(name) {
    const c = this._cfg;
    const explicit = { radar: c.radar_entity, sens: c.sensitivity_entity, bri: c.brightness_entity }[name];
    if (explicit) return explicit;
    const p = (c.climate || "").split(".")[1];
    if (!p) return null;
    return {
      radar: `switch.${p}_radar_detection`,
      sens: `select.${p}_radar_sensitivity`,
      bri: `number.${p}_active_brightness`,
    }[name];
  }

  _entityId(day) {
    return this._prefix + day;
  }

  _entity(day) {
    return this._hass.states[this._entityId(day)];
  }

  // message about the active group's entities (missing / unavailable), "" when all is well
  _problem() {
    const ids = this._groups[this._tab].days.map((d) => this._entityId(d));
    const missing = ids.filter((id) => !this._hass.states[id]);
    if (missing.length) return this._t("missing", missing.join(", "));
    const down = ids.filter((id) => ["unavailable", "unknown"].includes(this._hass.states[id].state));
    return down.length ? this._t("unavailable", down.join(", ")) : "";
  }

  _load() {
    const g = this._groups[this._tab];
    const texts = g.days.map((d) => this._entity(d)?.state);
    const parsed = parse(texts[0]);
    this._blocks = parsed.length ? parsed : [{ start: 0, temp: 21 }];
    this._differs = texts.some((t) => serialize(parse(t)) !== serialize(parse(texts[0])));
  }

  _validate() {
    const b = this._blocks;
    if (b[0].start !== 0) return this._t("err_first");
    if (b.length > this._cfg.max_blocks) return this._t("err_max", this._cfg.max_blocks);
    for (let i = 1; i < b.length; i++) if (b[i].start <= b[i - 1].start) return this._t("err_order");
    return "";
  }

  async _save() {
    this._error = this._validate();
    if (this._error) return this._render();
    const value = serialize(this._blocks);
    try {
      for (const d of this._groups[this._tab].days)
        await this._hass.callService("text", "set_value", {
          entity_id: this._entityId(d),
          value,
        });
      this._dirty = false;
      this._differs = false;
      // no _load() here: the entity states still hold the old plan, the update from HA triggers the reload
    } catch (e) {
      this._error = this._t("err_save", e.message || e);
    }
    this._render();
  }

  _edit(fn) {
    fn(this._blocks);
    this._dirty = true;
    this._error = "";
    this._render();
  }

  _end(i) {
    return i + 1 < this._blocks.length ? this._blocks[i + 1].start : DAY;
  }

  _openDialog(i, isNew) {
    this._dlg = {
      i,
      isNew,
      snap: JSON.parse(JSON.stringify(this._blocks)),
      dirtyBefore: this._dirty,
    };
    this._render();
  }

  _onChange(ev) {
    const el = ev.target.closest("select[data-sel]");
    if (!el || !this._dlg) return;
    const v = Number(el.value);
    const i = this._dlg.i;
    // block start = b[i].start, block end = start of the next block
    this._edit((b) => {
      if (el.dataset.sel === "start") b[i].start = v;
      else b[i + 1].start = v;
    });
  }

  _timeOptions(lo, hi, cur) {
    const ts = this._cfg.time_step;
    const values = new Set([cur]);
    for (let m = Math.ceil(lo / ts) * ts; m <= hi; m += ts) values.add(m);
    return [...values]
      .sort((a, b) => a - b)
      .map((m) => `<option value="${m}" ${m === cur ? "selected" : ""}>${fmtTime(m)}</option>`)
      .join("");
  }

  _onClick(ev) {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    const i = Number(el.dataset.i);
    const { min, max, step, time_step: ts } = this._cfg;
    if (act === "tab") {
      if (this._dirty) return; // unsaved changes: save or cancel first
      this._tab = i;
      this._error = "";
      this._load();
      this._render();
    } else if (act === "mode") {
      this._hass.callService("climate", "set_hvac_mode", {
        entity_id: this._cfg.climate,
        hvac_mode: el.dataset.mode,
      });
    } else if (act === "open") {
      this._openDialog(i, false);
    } else if (act === "add") {
      // splits the longest block in half and opens the dialog for the new block
      const b = this._blocks;
      let best = 0;
      for (let k = 0; k < b.length; k++)
        if (this._end(k) - b[k].start > this._end(best) - b[best].start) best = k;
      const len = this._end(best) - b[best].start;
      if (len < 2 * ts || b.length >= this._cfg.max_blocks) return;
      const start = b[best].start + Math.round(len / 2 / ts) * ts;
      this._dlg = {
        i: best + 1,
        isNew: true,
        snap: JSON.parse(JSON.stringify(b)),
        dirtyBefore: this._dirty,
      };
      b.splice(best + 1, 0, { start, temp: b[best].temp });
      this._render();
    } else if (act === "temp") {
      const d = Number(el.dataset.d) * step;
      this._edit((b) => {
        b[i].temp = Math.min(max, Math.max(min, +(Math.round((b[i].temp + d) / step) * step).toFixed(2)));
      });
    } else if (act === "del") {
      this._edit((b) => {
        b.splice(i, 1);
        b[0].start = 0;
      });
      this._dlg = null;
      this._render();
    } else if (act === "dlg-ok") {
      this._dirty =
        this._dlg.dirtyBefore || serialize(this._blocks) !== serialize(this._dlg.snap);
      this._dlg = null;
      this._render();
    } else if (act === "settings") {
      this._settings = true;
      this._render();
    } else if (act === "set-close") {
      this._settings = false;
      this._render();
    } else if (act === "rad") {
      this._hass.callService("switch", el.dataset.v === "on" ? "turn_on" : "turn_off", {
        entity_id: this._ent("radar"),
      });
    } else if (act === "sens") {
      this._hass.callService("select", "select_option", {
        entity_id: this._ent("sens"),
        option: el.dataset.v,
      });
    } else if (act === "bri") {
      const st = this._hass.states[this._ent("bri")];
      if (!st) return;
      const a = st.attributes;
      const cur = this._opt.bri ?? Number(st.state);
      const v = Math.min(a.max ?? 8, Math.max(a.min ?? 0, cur + Number(el.dataset.d) * (a.step ?? 1)));
      this._opt.bri = v;
      this._hass.callService("number", "set_value", { entity_id: this._ent("bri"), value: v });
      this._render();
    } else if (act === "dlg-cancel" || act === "dlg-bg") {
      if (act === "dlg-bg" && ev.target !== el) return; // a tap inside the dialog itself does not close it
      this._cancelOverlay();
    } else if (act === "save") this._save();
    else if (act === "cancel") {
      this._dirty = false;
      this._error = "";
      this._load();
      this._render();
    }
  }

  _cancelOverlay() {
    if (this._settings) {
      this._settings = false;
    } else if (this._dlg) {
      this._blocks = this._dlg.snap;
      this._dirty = this._dlg.dirtyBefore;
      this._dlg = null;
    }
    this._render();
  }

  _onKey(ev) {
    if (ev.key === "Escape" && (this._dlg || this._settings)) {
      ev.stopPropagation();
      this._cancelOverlay();
    } else if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.(".seg")) {
      ev.preventDefault();
      this._onClick({ target: ev.target });
    }
  }

  // the card is redrawn with innerHTML, so keyboard focus has to be put back by hand
  _focusKey() {
    const d = this.shadowRoot.activeElement?.dataset;
    if (!d) return null;
    if (d.sel) return `select[data-sel="${d.sel}"]`;
    if (!d.act) return null;
    return `[data-act="${d.act}"]${d.i !== undefined ? `[data-i="${d.i}"]` : ""}${d.d !== undefined ? `[data-d="${d.d}"]` : ""}`;
  }

  _dialogHtml() {
    const t = this._t;
    const lang = this._lang;
    const d = this._dlg;
    const b = this._blocks;
    const blk = b[d.i];
    if (!blk) return "";
    const ts = this._cfg.time_step;
    const first = d.i === 0;
    const { cold, warm, step } = this._cfg;
    const stepTxt = fmtTemp(step, lang);
    return `
      <div class="overlay" data-act="dlg-bg">
        <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
          <h3>${d.isNew ? t("new_block") : t("edit_block")}</h3>
          <div class="field">
            <div class="cap">${t("start")}</div>
            ${
              first
                ? `<div class="static">00:00</div><div class="note">${t("first_starts")}</div>`
                : `<select data-sel="start">${this._timeOptions(b[d.i - 1].start + ts, this._end(d.i) - ts, blk.start)}</select>`
            }
          </div>
          <div class="field">
            <div class="cap">${t("end")}</div>
            ${
              d.i + 1 < b.length
                ? `<select data-sel="end">${this._timeOptions(blk.start + ts, this._end(d.i + 1) - ts, this._end(d.i))}</select>`
                : `<div class="static">24:00</div><div class="note">${t("last_ends")}</div>`
            }
          </div>
          <div class="field">
            <div class="cap">${t("temperature")}</div>
            <div class="ctl big">
              <button data-act="temp" data-i="${d.i}" data-d="-1" title="${t("lower")} (${stepTxt} °C)">−</button>
              <span class="val" style="color:${color(blk.temp, cold, warm)}">${fmtTemp(blk.temp, lang)} °C</span>
              <button data-act="temp" data-i="${d.i}" data-d="1" title="${t("higher")} (${stepTxt} °C)">+</button>
            </div>
          </div>
          <div class="actions">
            ${
              !d.isNew && b.length > 1
                ? `<button class="danger" data-act="del" data-i="${d.i}">${t("delete")}</button>`
                : ""
            }
            <button data-act="dlg-cancel">${t("cancel")}</button>
            <button class="save" data-act="dlg-ok">${t("done")}</button>
          </div>
        </div>
      </div>`;
  }

  _settingsHtml() {
    const t = this._t;
    const h = this._hass;
    const rad = h.states[this._ent("radar")];
    const sens = h.states[this._ent("sens")];
    const bri = h.states[this._ent("bri")];
    const seg = (act, opts, cur) =>
      `<div class="seg2">${opts
        .map(([v, l]) => `<button class="${cur === v ? "sel" : ""}" data-act="${act}" data-v="${esc(v)}">${esc(l)}</button>`)
        .join("")}</div>`;
    const briVal = bri ? this._opt.bri ?? Number(bri.state) : null;
    const sensLabels = SENS_LABELS[this._lang] || SENS_LABELS.en;
    const sensOpts = sens ? (sens.attributes.options || ["low", "medium", "high"]).map((o) => [o, sensLabels[o] || o]) : [];
    return `
      <div class="overlay" data-act="dlg-bg">
        <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
          <h3>${t("settings_title")}</h3>
          ${
            rad
              ? `<div class="field"><div class="cap">${t("radar")}</div>${seg("rad", [["on", t("radar_on")], ["off", t("radar_off")]], rad.state)}</div>`
              : ""
          }
          ${
            sens
              ? `<div class="field"><div class="cap">${t("sensitivity")}</div>${seg("sens", sensOpts, sens.state)}</div>`
              : ""
          }
          ${
            bri
              ? `<div class="field"><div class="cap">${t("brightness")}</div>
                  <div class="ctl big">
                    <button data-act="bri" data-d="-1" title="${t("darker")}">−</button>
                    <span>${briVal}</span>
                    <button data-act="bri" data-d="1" title="${t("brighter")}">+</button>
                  </div></div>`
              : ""
          }
          <div class="actions"><button class="save" data-act="set-close">${t("done")}</button></div>
        </div>
      </div>`;
  }

  _groupLabel(g) {
    const lang = this._lang;
    if (g.idx.length === 7) return this._t("every_day");
    if (g.idx.length > 1)
      return `${weekday(lang, g.idx[0], "short")}–${weekday(lang, g.idx[g.idx.length - 1], "short")}`;
    return weekday(lang, g.idx[0], this._cfg.grouping === "daily" ? "short" : "long");
  }

  _render() {
    if (!this._blocks || !this.shadowRoot) return;
    const t = this._t;
    const lang = this._lang;
    const cfg = this._cfg;
    const title = esc(cfg.title ?? t("default_title"));
    const problem = this._problem();
    const keep = this._focusKey();
    const clim = cfg.climate && this._hass.states[cfg.climate];
    const b = this._blocks;
    const full = b.length >= cfg.max_blocks;
    const hasSettings = ["radar", "sens", "bri"].some((n) => this._hass.states[this._ent(n)]);
    const modes = [["off", t("mode_off")], ["auto", t("mode_auto")], ["heat", t("mode_heat")]]
      .filter(([m]) => !clim || (clim.attributes.hvac_modes || []).includes(m))
      .map(
        ([m, l]) =>
          `<button class="tab ${clim && clim.state === m ? "on" : ""}" data-act="mode" data-mode="${m}">${l}</button>`
      )
      .join("");
    const tabs =
      this._groups.length > 1
        ? `<div class="tabs">${this._groups
            .map(
              (g, i) =>
                `<button class="tab ${i === this._tab ? "on" : ""}" data-act="tab" data-i="${i}" ${this._dirty ? "disabled" : ""}>${esc(this._groupLabel(g))}</button>`
            )
            .join("")}</div>`
        : "";
    const col = (temp) => color(temp, cfg.cold, cfg.warm);
    const bar = b
      .map((blk, i) => {
        const w = ((this._end(i) - blk.start) / DAY) * 100;
        return `<div class="seg" role="button" tabindex="0" data-act="open" data-i="${i}" title="${fmtTime(blk.start)} – ${fmtEnd(this._end(i))}" aria-label="${fmtTime(blk.start)} – ${fmtEnd(this._end(i))}, ${fmtTemp(blk.temp, lang)} °C" style="width:${w}%;background:${col(blk.temp)}">${w >= 6 ? fmtTemp(blk.temp, lang) : ""}</div>`;
      })
      .join("");
    const rows = b
      .map(
        (blk, i) => `
      <button class="blk" data-act="open" data-i="${i}">
        <span class="t">${fmtTime(blk.start)} – ${fmtEnd(this._end(i))}</span>
        <span class="v" style="color:${col(blk.temp)}">${fmtTemp(blk.temp, lang)} °C</span>
        <span class="chev">›</span>
      </button>`
      )
      .join("");
    const action = clim && clim.attributes.hvac_action;
    const actionLabel = {
      heating: t("act_heating"),
      preheating: t("act_preheating"),
      idle: t("act_idle"),
      off: t("act_off"),
    };
    const badge = action
      ? `<span class="act ${esc(action)}"><span class="dot"></span>${esc(actionLabel[action] || action)}</span>`
      : "";
    const sub = clim
      ? `<span>${t("now_target", fmtTemp(clim.attributes.current_temperature, lang), fmtTemp(clim.attributes.temperature, lang))}</span>${badge}`
      : "";
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .wrap { position: relative; container-type: inline-size; }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
        h2 { margin: 0; font-size: 1.3em; font-weight: 500; }
        .gear { padding: 8px 14px; font-size: .9em; }
        .seg2 { display: flex; gap: 8px; }
        .seg2 button { flex: 1; padding: 14px 0; font-size: 1.05em; }
        .seg2 button.sel, .tab.on { background: color-mix(in srgb, var(--primary-color) 22%, var(--secondary-background-color));
                                     color: var(--primary-color); font-weight: 500;
                                     box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--primary-color) 45%, transparent); }
        h3 { margin: 0 0 12px; font-size: 1.15em; font-weight: 500; }
        .sub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
               color: var(--secondary-text-color); margin-bottom: 12px; }
        .act { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px;
               font-weight: 500; background: var(--secondary-background-color); }
        .act .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .act.heating, .act.preheating { color: var(--state-climate-heat-color, #ff8100);
               background: color-mix(in srgb, var(--state-climate-heat-color, #ff8100) 18%, transparent); }
        .act.heating .dot { animation: pulse 1.6s ease-in-out infinite; }
        @keyframes pulse { 50% { opacity: .3; } }
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        button { font: inherit; color: inherit; border: none; cursor: pointer;
                 background: var(--secondary-background-color); border-radius: 12px;
                 transition: background-color .15s, box-shadow .15s, transform .1s, filter .15s, opacity .15s;
                 -webkit-tap-highlight-color: transparent; }
        .tab { flex: 1; padding: 14px 0; font-size: 1.05em; }
        /* state layer over the background (works on coloured buttons too); hover for mouse only,
           so it does not stay "stuck" on a tablet */
        @media (hover: hover) {
          button:not(:disabled):hover, select:hover {
            background-image: linear-gradient(color-mix(in srgb, currentColor 9%, transparent),
                                              color-mix(in srgb, currentColor 9%, transparent)); }
          select:hover { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"),
                                         linear-gradient(color-mix(in srgb, currentColor 9%, transparent),
                                                         color-mix(in srgb, currentColor 9%, transparent)); }
          .seg:hover { filter: brightness(1.12) saturate(1.1); }
          .blk:hover .chev { transform: translateX(3px); color: var(--primary-color); }
        }
        button:not(:disabled):active { transform: scale(.97);
          background-image: linear-gradient(color-mix(in srgb, currentColor 16%, transparent),
                                            color-mix(in srgb, currentColor 16%, transparent)); }
        .seg:active { filter: brightness(.92); }
        button:focus-visible, select:focus-visible, .seg:focus-visible {
          outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .seg:focus-visible { outline-offset: -3px; outline-color: #fff; }
        .bar { display: flex; height: 44px; border-radius: 10px; overflow: hidden; margin-bottom: 4px; }
        .seg { display: flex; align-items: center; justify-content: center; color: #fff;
               font-weight: 500; border-right: 2px solid var(--card-background-color); box-sizing: border-box;
               cursor: pointer; transition: filter .15s;
               font-size: clamp(11px, 3.4cqw, 16px); overflow: hidden; }
        .seg:last-child { border-right: none; }
        .axis { display: flex; justify-content: space-between; font-size: .8em;
                color: var(--secondary-text-color); margin-bottom: 12px; }
        .blk { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px;
               padding: 0 14px; margin-bottom: 6px; text-align: left; font-size: 1.1em; }
        .blk .t { flex: 1; }
        .blk .v { font-weight: 500; }
        .blk .chev { color: var(--secondary-text-color); font-size: 1.4em; transition: transform .15s, color .15s; }
        .actions { display: flex; gap: 8px; margin-top: 12px; }
        .actions button { flex: 1; padding: 14px 0; font-size: 1.05em; }
        /* text in the card colour: contrasts with the primary colour in light and dark themes
           (--text-primary-color is light in some dark themes) */
        .save { background: var(--primary-color); color: var(--card-background-color, #fff); font-weight: 500; }
        .danger { color: var(--error-color); }
        button:disabled { opacity: .3; cursor: default; }
        .tab.on:disabled { opacity: 1; }
        .hint { margin: -8px 0 12px; }
        .dialog:focus { outline: none; }
        .warn { color: var(--warning-color, orange); margin: 8px 0; }
        .err { color: var(--error-color); margin: 8px 0; }
        .overlay { position: absolute; inset: -16px; z-index: 5; display: flex; align-items: flex-start;
                   justify-content: center; padding: 16px; box-sizing: border-box;
                   background: rgba(0, 0, 0, .55); border-radius: var(--ha-card-border-radius, 12px); }
        .dialog { width: 100%; max-width: 420px; margin-top: 56px; padding: 16px; box-sizing: border-box;
                  background: var(--card-background-color); border-radius: 16px;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, .5); }
        .field { margin-bottom: 14px; text-align: center; }
        h3 { text-align: center; }
        select { width: 100%; height: 56px; font: inherit; font-size: 1.4em; color: inherit;
                 background: var(--secondary-background-color); border: none; border-radius: 12px;
                 text-align: center; text-align-last: center; cursor: pointer;
                 appearance: none; -moz-appearance: none; -webkit-appearance: none;
                 padding: 0 48px;
                 background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
                 background-repeat: no-repeat; background-position: right 20px center; }
        .static { height: 56px; line-height: 56px; font-size: 1.4em; color: var(--secondary-text-color); }
        .cap { font-size: .85em; color: var(--secondary-text-color); margin-bottom: 4px; }
        .note { font-size: .8em; color: var(--secondary-text-color); margin-top: 4px; }
        .ctl { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ctl.big button { width: 56px; height: 56px; font-size: 1.6em; }
        .ctl span { flex: 1; text-align: center; font-size: 1.4em; }
      </style>
      <ha-card><div class="wrap">
        <div class="head">
          <h2>${title}</h2>
          ${hasSettings ? `<button class="gear" data-act="settings">${t("settings")}</button>` : ""}
        </div>
        <div class="sub">${sub}</div>
        ${clim ? `<div class="tabs">${modes}</div>` : ""}
        ${clim && clim.state !== "auto" ? `<div class="warn">${t("not_auto")}</div>` : ""}
        ${tabs}${tabs && this._dirty ? `<div class="note hint">${t("save_first")}</div>` : ""}
        ${
          problem
            ? `<div class="err">${esc(problem)}</div>`
            : `
        ${this._differs && !this._dirty ? `<div class="warn">${t("differs")}</div>` : ""}
        <div class="bar">${bar}</div>
        <div class="axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
        ${rows}
        <div class="actions">
          <button data-act="add" ${full ? "disabled" : ""}>${t("add_block")}</button>
        </div>
        ${this._error ? `<div class="err">${esc(this._error)}</div>` : ""}
        <div class="actions">
          <button data-act="cancel" ${this._dirty ? "" : "disabled"}>${t("cancel")}</button>
          <button class="save" data-act="save" ${this._dirty ? "" : "disabled"}>${t("save")}</button>
        </div>`
        }
        ${this._dlg ? this._dialogHtml() : ""}
        ${this._settings ? this._settingsHtml() : ""}
      </div></ha-card>`;
    const root = this.shadowRoot;
    const overlay = this._dlg || this._settings;
    let target = keep && root.querySelector?.(keep);
    if (!target && overlay && !this._overlayFocused) target = root.querySelector?.(".dialog");
    this._overlayFocused = !!overlay;
    target?.focus?.();
  }
}

const EDITOR_LABELS = {
  climate: "ed_climate",
  title: "ed_title",
  entity_prefix: "ed_prefix",
  grouping: "ed_grouping",
  min: "ed_min",
  max: "ed_max",
  step: "ed_step",
  time_step: "ed_time_step",
  max_blocks: "ed_max_blocks",
  language: "ed_language",
  radar_entity: "ed_radar",
  sensitivity_entity: "ed_sens",
  brightness_entity: "ed_bri",
};

class ThermostatScheduleCardEditor extends HTMLElement {
  setConfig(config) {
    this._cfg = config;
    this._data = this._toData(config);
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  // ha-form selects work with strings; "auto" stands for "no language set"
  _toData(cfg) {
    return {
      ...cfg,
      time_step: cfg.time_step ? String(cfg.time_step) : undefined,
      language: cfg.language || "auto",
    };
  }

  _schema(t) {
    return [
      { name: "climate", selector: { entity: { domain: "climate" } } },
      { name: "title", selector: { text: {} } },
      { name: "entity_prefix", selector: { text: {} } },
      {
        name: "grouping",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "workdays", label: t("ed_group_workdays") },
              { value: "daily", label: t("ed_group_daily") },
              { value: "all", label: t("ed_group_all") },
            ],
          },
        },
      },
      {
        type: "expandable",
        name: "",
        title: t("ed_advanced"),
        schema: [
          { name: "min", selector: { number: { min: 0, max: 50, step: 0.5, mode: "box" } } },
          { name: "max", selector: { number: { min: 0, max: 50, step: 0.5, mode: "box" } } },
          { name: "step", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box" } } },
          {
            name: "time_step",
            selector: {
              select: {
                mode: "dropdown",
                options: ["5", "10", "15", "20", "30", "60"].map((v) => ({ value: v, label: v })),
              },
            },
          },
          { name: "max_blocks", selector: { number: { min: 2, max: 24, step: 1, mode: "box" } } },
          {
            name: "language",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "auto", label: t("ed_auto") },
                  { value: "en", label: "English" },
                  { value: "cs", label: "Čeština" },
                ],
              },
            },
          },
          { name: "radar_entity", selector: { entity: { domain: "switch" } } },
          { name: "sensitivity_entity", selector: { entity: { domain: "select" } } },
          { name: "brightness_entity", selector: { entity: { domain: "number" } } },
        ],
      },
    ];
  }

  _update() {
    if (!this._cfg || !this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = {};
        for (const [k, v] of Object.entries(ev.detail.value)) {
          if (v === "" || v === undefined || v === null) continue;
          if (k === "language" && v === "auto") continue;
          config[k] = k === "time_step" ? Number(v) : v;
        }
        this._cfg = config;
        this._data = this._toData(config);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._data;
    // hass arrives on every state change in HA; assign the schema only when it really changes,
    // otherwise ha-form redraws (and may drop focus) while the user is typing
    const lang = langOf(this._hass, this._cfg);
    if (this._schemaLang !== lang) {
      this._schemaLang = lang;
      const t = makeT(lang);
      this._form.schema = this._schema(t);
      this._form.computeLabel = (s) => (EDITOR_LABELS[s.name] ? t(EDITOR_LABELS[s.name]) : s.name);
    }
  }
}

customElements.define("thermostat-schedule-card", ThermostatScheduleCard);
customElements.define("thermostat-schedule-card-editor", ThermostatScheduleCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "thermostat-schedule-card")) {
  window.customCards.push({
    type: "thermostat-schedule-card",
    name: "Thermostat Schedule Card",
    description: "Weekly schedule editor for Zigbee2MQTT thermostats (Sonoff WGZBA)",
    preview: false,
    documentationURL: "https://github.com/myreczek/thermostat-schedule-card",
  });
}
console.info(`%c THERMOSTAT-SCHEDULE-CARD %c ${VERSION} `, "color:#fff;background:#03a9f4;font-weight:700", "color:#03a9f4;background:#fff");
