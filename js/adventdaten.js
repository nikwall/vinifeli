// Speicher der Adventskette: Supabase-Tabellen aus tools/advent.sql.
// Ist die Datenbank nicht erreichbar, bleibt alles im Browser dieses Geräts (localStorage).
import { abruf, pruefen } from "./reaktionen.js";
import { merken } from "./format.js";

const ID = /^[0-9a-f-]{36}$/i;
const id = (x) => { if (!ID.test(String(x))) throw new Error("Ungültige Kennung"); return x; };
const neueId = () => crypto.randomUUID();

// Nur für den Speicher auf dem Gerät; in der Datenbank sind sie einmal angelegt.
const START = [
  { name: "PEZ-Packung", anzahl: 4 },
  { name: "PEZ-Spender Buzz", anzahl: 1 },
  { name: "PEZ-Spender Woody", anzahl: 1 },
  { name: "Elektrobausatz", anzahl: null },
];

function datenbank() {
  const senden = (pfad, methode, body) =>
    abruf(pfad, { method: methode, headers: { Prefer: "return=minimal" }, body: body && JSON.stringify(body) }).then(pruefen);
  return {
    quelle: "db",
    async laden() {
      // Hängt die Datenbank, nach zehn Sekunden aufgeben statt ewig „wird geladen“ zu zeigen.
      const opt = { signal: AbortSignal.timeout(10000) };
      const [dinge, kette] = await Promise.all([
        abruf("fz_advent_dinge?select=id,name,anzahl,erstellt&order=erstellt.asc", opt).then(pruefen).then((r) => r.json()),
        abruf("fz_advent_kette?select=id,tag,kind,ding,notiz,erstellt&order=erstellt.asc", opt).then(pruefen).then((r) => r.json()),
      ]);
      return { dinge, kette };
    },
    dingNeu: (d) => senden("fz_advent_dinge", "POST", { id: id(d.id), name: d.name, anzahl: d.anzahl }),
    dingAendern: (x, f) => senden(`fz_advent_dinge?id=eq.${id(x)}`, "PATCH", f),
    dingWeg: (x) => senden(`fz_advent_dinge?id=eq.${id(x)}`, "DELETE"),
    legen: (e) => senden("fz_advent_kette", "POST", { id: id(e.id), tag: e.tag, kind: e.kind, ding: id(e.ding), notiz: e.notiz || null }),
    notiz: (x, notiz) => senden(`fz_advent_kette?id=eq.${id(x)}`, "PATCH", { notiz: notiz || null }),
    nehmen: (x) => senden(`fz_advent_kette?id=eq.${id(x)}`, "DELETE"),
  };
}

function geraet() {
  const K = "fz_advent";
  const lesen = () => {
    let s = merken.lesen(K, null);
    if (!s) {
      const jetzt = new Date().toISOString();
      s = { dinge: START.map((d) => ({ id: neueId(), ...d, erstellt: jetzt })), kette: [] };
      merken.schreiben(K, s);
    }
    return s;
  };
  const aendern = async (f) => { const s = lesen(); f(s); merken.schreiben(K, s); };
  const jetzt = () => new Date().toISOString();
  return {
    quelle: "lokal",
    async laden() { return structuredClone(lesen()); },
    dingNeu: (d) => aendern((s) => s.dinge.push({ ...d, erstellt: jetzt() })),
    dingAendern: (x, f) => aendern((s) => Object.assign(s.dinge.find((d) => d.id === x) ?? {}, f)),
    dingWeg: (x) => aendern((s) => { s.dinge = s.dinge.filter((d) => d.id !== x); s.kette = s.kette.filter((e) => e.ding !== x); }),
    legen: (e) => aendern((s) => s.kette.push({ ...e, notiz: e.notiz || null, erstellt: jetzt() })),
    notiz: (x, notiz) => aendern((s) => { const e = s.kette.find((k) => k.id === x); if (e) e.notiz = notiz || null; }),
    nehmen: (x) => aendern((s) => { s.kette = s.kette.filter((e) => e.id !== x); }),
  };
}

// „?lokal“ in der Adresse erzwingt den Gerätespeicher (zum Ausprobieren). Beim Laden gelesen,
// weil der App-Rahmen die Adresse danach umschreibt.
const NUR_LOKAL = new URLSearchParams(location.search).has("lokal");

// Liefert den Speicher samt erstem Stand.
export async function oeffneAdvent() {
  if (!NUR_LOKAL) {
    const db = datenbank();
    try { return { speicher: db, stand: await db.laden() }; } catch (e) { console.warn("Adventskette: Datenbank nicht erreichbar", e); }
  }
  const g = geraet();
  return { speicher: g, stand: await g.laden() };
}

export { neueId };
