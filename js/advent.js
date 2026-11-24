// Bereich „Advent“: Geschenke anlegen und auf die Adventskette verteilen, 24 Päckchen je Kind.
import { esc } from "./format.js";
import { neueId, oeffneAdvent } from "./adventdaten.js";

const KINDER = [
  { id: "lilly", name: "Lilly" },
  { id: "felice", name: "Félice" },
];
const TAGE = Array.from({ length: 24 }, (_, i) => i + 1);
const breit = () => window.matchMedia("(min-width: 900px)").matches;

const ICON = {
  kette: '<path d="M12 2v20M9 6.500h3M12 12h3M9 17.500h3"/><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="9.500" width="6" height="5" rx="1"/><rect x="3" y="15" width="6" height="5" rx="1"/>',
  geschenke: '<rect x="3" y="9" width="18" height="12" rx="1.500"/><path d="M12 9v12M3 13h18M12 9C10.500 5 6.500 4.500 6.500 7S10 9 12 9zm0 0c1.500-4 5.500-4.500 5.500-2S14 9 12 9z"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

function heutigerTag() {
  const d = new Date();
  return d.getMonth() === 11 && d.getDate() <= 24 ? d.getDate() : null;
}

export async function zeigeAdvent(wurzel) {
  wurzel.innerHTML = '<p class="laden">Adventskette wird geladen …</p>';
  const { speicher, stand: erst } = await oeffneAdvent();
  let stand = erst;
  let ansicht = "kette";
  let modus = null; // Geschenk, das gerade per Tippen verteilt wird
  let offen = null; // { tag, kind } des geöffneten Päckchens
  let bearbeitet = null; // Geschenk im Dialog, null = neu
  let toastZeit = 0;

  wurzel.innerHTML = `
    <section class="advent" data-ansicht="kette">
      ${speicher.quelle === "lokal" ? '<p class="ad-hinweis">Die Datenbank ist gerade nicht erreichbar. Was du jetzt einträgst, bleibt nur auf diesem Gerät.</p>' : ""}
      <div class="v-kette">
        <div class="ad-stand"></div>
        <div class="ad-oben">
          <div class="ad-modus" hidden></div>
          <div class="kette-kopf">${KINDER.map((k, i) => `${i === 1 ? "<span></span>" : ""}<span class="k-${k.id}">${esc(k.name)}</span>`).join("")}</div>
        </div>
        <ol class="kette"></ol>
      </div>
      <div class="v-vorrat">
        <div class="vorrat-kopf">
          <h2>Geschenke</h2>
          <button class="primaer" data-neu>+ Geschenk</button>
        </div>
        <div class="vorrat"></div>
        <p class="klein ad-fuss">Stückzahl heißt: jedes Stück kommt in ein Päckchen. „Beliebig verteilbar“ passt für Bauteile, Puzzleteile und Ähnliches, das sich auf viele Päckchen aufteilen lässt.</p>
      </div>
      <nav class="unten" aria-label="Ansicht">
        <button data-ansicht="kette" aria-current="true">${icon("kette")}Kette</button>
        <button data-ansicht="vorrat" aria-current="false">${icon("geschenke")}Geschenke</button>
      </nav>
      <div class="ad-toast" role="status" hidden></div>
      <dialog id="ad-paeckchen" class="dialog"><div class="dlg"></div></dialog>
      <dialog id="ad-ding" class="dialog klein">
        <form method="dialog" class="dlg">
          <div class="dlg-kopf"><h2></h2><button class="x" value="zu" formnovalidate aria-label="Schließen">×</button></div>
          <label class="ad-feld">Name<input name="titel" maxlength="80" required autocomplete="off"></label>
          <label class="ad-wahl"><input type="radio" name="art" value="stueck" checked> Stückzahl <input type="number" name="anzahl" min="1" max="999" value="1" inputmode="numeric"></label>
          <label class="ad-wahl"><input type="radio" name="art" value="teilbar"> Beliebig verteilbar, etwa Bauteile</label>
          <p class="klein ad-warn" hidden></p>
          <div class="dlg-knoepfe">
            <button class="link ad-weg" value="weg" formnovalidate>Löschen</button>
            <button class="link" value="ok">Speichern</button>
            <button class="primaer" value="verteilen">Verteilen</button>
          </div>
        </form>
      </dialog>
    </section>`;
  const el = (s) => wurzel.querySelector(s);
  const sektion = el(".advent");
  const dlgP = el("#ad-paeckchen");
  const dlgD = el("#ad-ding");
  const form = dlgD.querySelector("form");

  // Abgeleitete Werte
  const ding = (x) => stand.dinge.find((d) => d.id === x);
  const inPaeckchen = (tag, kind) => stand.kette.filter((e) => e.tag === tag && e.kind === kind && ding(e.ding));
  const verteilt = (d) => stand.kette.filter((e) => e.ding === d.id).length;
  const rest = (d) => (d.anzahl == null ? Infinity : d.anzahl - verteilt(d));
  const kindName = (k) => KINDER.find((x) => x.id === k)?.name ?? k;

  // Speichern: Ansicht sofort ändern, bei Fehler den Stand neu holen.
  async function aendern(lokal, fern, fehlerText = "Nicht gespeichert. Bitte noch einmal versuchen.") {
    lokal();
    zeichnen();
    try { await fern(); } catch (e) {
      console.error(e);
      toast(fehlerText);
      await neuLaden();
    }
  }

  async function neuLaden() {
    try { stand = await speicher.laden(); } catch (e) { console.warn(e); return; }
    if (modus && !ding(modus)) modus = null;
    zeichnen();
  }

  function toast(text, rueck) {
    const t = el(".ad-toast");
    t.innerHTML = `<span>${esc(text)}</span>${rueck ? '<button class="link">Rückgängig</button>' : ""}`;
    t.hidden = false;
    if (rueck) t.querySelector("button").addEventListener("click", () => { t.hidden = true; rueck(); }, { once: true });
    const z = ++toastZeit;
    setTimeout(() => { if (z === toastZeit) t.hidden = true; }, rueck ? 5000 : 3500);
  }

  // Zeichnen
  function geschenkText(e) {
    const d = ding(e.ding);
    return `${esc(d.name)}${e.notiz ? `<small>: ${esc(e.notiz)}</small>` : ""}`;
  }

  function zeichneKette() {
    const heute = heutigerTag();
    el(".kette").innerHTML = TAGE.map((t) => `
      <li class="glied${t === heute ? " heute" : ""}" data-tag="${t}">
        ${KINDER.map((k, i) => {
          const inhalt = inPaeckchen(t, k.id);
          const knoten = i === 1 ? `<span class="knoten" aria-hidden="true">${t}</span>` : "";
          return `${knoten}<button class="pk k-${k.id}${inhalt.length ? " voll" : ""}" data-tag="${t}" data-kind="${k.id}" aria-label="Päckchen ${t} für ${esc(k.name)}${inhalt.length ? "" : ", leer"}">
            ${inhalt.length ? inhalt.map((e) => `<span class="geschenk">${geschenkText(e)}</span>`).join("") : '<span class="pk-leer">leer</span>'}
          </button>`;
        }).join("")}
      </li>`).join("");

    const gefuellt = KINDER.map((k) => `<b class="k-${k.id}">${esc(k.name)}</b> ${TAGE.filter((t) => inPaeckchen(t, k.id).length).length} von 24`);
    const uebrig = stand.dinge.filter((d) => d.anzahl != null && rest(d) > 0);
    el(".ad-stand").innerHTML = `
      <p>Gefüllt: ${gefuellt.join(" · ")}</p>
      ${uebrig.length ? `<p class="klein">Noch nicht verteilt: ${uebrig.map((d) => `${esc(d.name)} ${rest(d)}`).join(", ")}</p>` : stand.dinge.length ? '<p class="klein">Alle gezählten Geschenke sind verteilt.</p>' : ""}`;

    const m = el(".ad-modus");
    const md = modus && ding(modus);
    m.hidden = !md;
    sektion.classList.toggle("verteilen", !!md);
    if (md) {
      const r = rest(md);
      m.innerHTML = `<span><b>${esc(md.name)}</b> verteilen${r === Infinity ? "" : ` · noch ${r}`}<br><small>Tippe auf ein Päckchen.</small></span><button class="link" data-fertig>Fertig</button>`;
    }
  }

  function zeichneVorrat() {
    const v = el(".vorrat");
    if (!stand.dinge.length) { v.innerHTML = '<p class="leer">Noch keine Geschenke angelegt.</p>'; return; }
    v.innerHTML = stand.dinge.map((d) => {
      const n = verteilt(d);
      const wo = KINDER.map((k) => {
        const tage = [...new Set(stand.kette.filter((e) => e.ding === d.id && e.kind === k.id).map((e) => e.tag))].sort((a, b) => a - b);
        return tage.length ? `${esc(k.name)}: ${tage.join(", ")}` : "";
      }).filter(Boolean).join(" · ");
      let zeile, anteil = 0, warn = "";
      if (d.anzahl == null) {
        zeile = n ? `in ${n} Päckchen · beliebig verteilbar` : "beliebig verteilbar, noch in keinem Päckchen";
      } else {
        zeile = `${n} von ${d.anzahl} verteilt`;
        anteil = Math.min(1, n / d.anzahl);
        if (n > d.anzahl) warn = `<p class="ad-zuviel">${n - d.anzahl} mehr verteilt als vorhanden</p>`;
      }
      const fertig = d.anzahl != null && n >= d.anzahl;
      return `
        <article class="ding${modus === d.id ? " aktiv" : ""}" data-id="${esc(d.id)}">
          <div class="ding-text">
            <b>${esc(d.name)}</b>
            <span>${zeile}</span>
            ${d.anzahl != null ? `<span class="balken${fertig ? " fertig" : ""}"><i style="width:${Math.round(anteil * 100)}%"></i></span>` : ""}
            ${wo ? `<small>${wo}</small>` : ""}
            ${warn}
          </div>
          <div class="ding-knoepfe">
            <button class="ding-verteilen" data-verteilen="${esc(d.id)}"${fertig ? " disabled" : ""}>${fertig ? "Verteilt" : "Verteilen"}</button>
            <button class="link" data-bearbeiten="${esc(d.id)}">Ändern</button>
          </div>
        </article>`;
    }).join("");
  }

  function zeichnePaeckchen() {
    if (!offen) return;
    const { tag, kind } = offen;
    const inhalt = inPaeckchen(tag, kind);
    const angebot = stand.dinge.map((d) => {
      const r = rest(d);
      const zu = r <= 0;
      return `<button class="ad-add" data-legen="${esc(d.id)}"${zu ? " disabled" : ""}>
        <span>${esc(d.name)}</span><small>${d.anzahl == null ? "beliebig" : zu ? "alle verteilt" : `noch ${r}`}</small></button>`;
    }).join("");
    dlgP.querySelector(".dlg").innerHTML = `
      <div class="dlg-kopf"><h2>${tag}. Dezember · ${esc(kindName(kind))}</h2><button class="x" data-zu aria-label="Schließen">×</button></div>
      <h3>Im Päckchen</h3>
      ${inhalt.length ? `<ul class="ad-inhalt">${inhalt.map((e) => {
        const d = ding(e.ding);
        return `<li>
          <span>${esc(d.name)}</span>
          ${d.anzahl == null ? `<input class="ad-notiz" data-notiz="${esc(e.id)}" value="${esc(e.notiz ?? "")}" maxlength="80" placeholder="welches Teil?" aria-label="Welches Teil">` : ""}
          <button class="k-weg" data-nehmen="${esc(e.id)}" aria-label="${esc(d.name)} herausnehmen">×</button>
        </li>`;
      }).join("")}</ul>` : '<p class="satz">Noch leer.</p>'}
      <h3>Hineinlegen</h3>
      ${stand.dinge.length ? `<div class="ad-angebot">${angebot}</div>` : '<p class="satz">Lege zuerst unter „Geschenke“ etwas an.</p>'}`;
  }

  function zeichnen() {
    zeichneKette();
    zeichneVorrat();
    zeichnePaeckchen();
  }

  function zeigeAnsicht(a) {
    ansicht = a;
    sektion.dataset.ansicht = a;
    el(".unten").querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.ansicht === a)));
    if (!breit()) window.scrollTo(0, 0);
  }

  // Aktionen
  function legen(tag, kind, dingId) {
    const d = ding(dingId);
    if (!d || rest(d) <= 0) return null;
    const e = { id: neueId(), tag, kind, ding: dingId, notiz: null };
    aendern(() => stand.kette.push(e), () => speicher.legen(e));
    return e;
  }

  function nehmen(eid) {
    aendern(() => { stand.kette = stand.kette.filter((e) => e.id !== eid); }, () => speicher.nehmen(eid));
  }

  function verteilenStarten(dingId) {
    const d = ding(dingId);
    if (!d) return;
    if (rest(d) <= 0) { toast(`${d.name}: alle verteilt`); return; }
    modus = dingId;
    zeigeAnsicht("kette");
    zeichnen();
  }

  function dingDialog(d) {
    bearbeitet = d ?? null;
    dlgD.querySelector("h2").textContent = d ? "Geschenk ändern" : "Neues Geschenk";
    form.titel.value = d?.name ?? "";
    form.art.value = d && d.anzahl == null ? "teilbar" : "stueck";
    form.anzahl.value = d?.anzahl ?? 1;
    dlgD.querySelector(".ad-weg").hidden = !d;
    const w = dlgD.querySelector(".ad-warn");
    w.hidden = true;
    dlgD.showModal();
    if (!d) form.titel.focus();
  }

  form.addEventListener("submit", (ev) => {
    const was = ev.submitter?.value;
    if (was === "zu") return;
    const d = bearbeitet;
    if (was === "weg") {
      const n = verteilt(d);
      if (n && !confirm(`${d.name} liegt in ${n} Päckchen. Trotzdem löschen?`)) { ev.preventDefault(); return; }
      if (modus === d.id) modus = null;
      aendern(() => {
        stand.dinge = stand.dinge.filter((x) => x.id !== d.id);
        stand.kette = stand.kette.filter((e) => e.ding !== d.id);
      }, () => speicher.dingWeg(d.id));
      return;
    }
    const name = form.titel.value.trim().slice(0, 80);
    if (!name) { ev.preventDefault(); return; }
    const anzahl = form.art.value === "teilbar" ? null : Math.max(1, Math.min(999, Math.round(Number(form.anzahl.value) || 1)));
    let ziel;
    if (d) {
      ziel = d.id;
      aendern(() => Object.assign(d, { name, anzahl }), () => speicher.dingAendern(d.id, { name, anzahl }));
    } else {
      const neu = { id: neueId(), name, anzahl, erstellt: new Date().toISOString() };
      ziel = neu.id;
      aendern(() => stand.dinge.push(neu), () => speicher.dingNeu(neu));
    }
    if (was === "verteilen") verteilenStarten(ziel);
  });

  // Hinweis im Dialog, wenn die Stückzahl unter das schon Verteilte fällt.
  form.addEventListener("input", () => {
    const w = dlgD.querySelector(".ad-warn");
    const n = bearbeitet ? verteilt(bearbeitet) : 0;
    const a = Number(form.anzahl.value);
    w.hidden = !(form.art.value === "stueck" && n > a);
    w.textContent = `Schon ${n}-mal verteilt. Nimm danach ${n - a} wieder heraus.`;
    if (document.activeElement === form.anzahl) form.art.value = "stueck";
  });

  sektion.addEventListener("click", (ev) => {
    const z = ev.target;
    const b = z.closest("button");
    if (!b || b.disabled) return;
    if (b.closest(".unten")) { zeigeAnsicht(b.dataset.ansicht); return; }
    if (b.matches("[data-neu]")) { dingDialog(null); return; }
    if (b.dataset.bearbeiten) { dingDialog(ding(b.dataset.bearbeiten)); return; }
    if (b.dataset.verteilen) { verteilenStarten(b.dataset.verteilen); return; }
    if (b.matches("[data-fertig]")) { modus = null; zeichnen(); return; }
    if (b.classList.contains("pk")) {
      const tag = Number(b.dataset.tag);
      const kind = b.dataset.kind;
      if (modus) {
        const d = ding(modus);
        const e = legen(tag, kind, modus);
        if (!e) return;
        if (rest(d) <= 0) modus = null;
        zeichnen();
        toast(`${d.name} → ${tag}. Dezember, ${kindName(kind)}`, () => {
          if (!ding(d.id)) return;
          if (!modus && rest(d) === 0) modus = d.id;
          nehmen(e.id);
        });
        return;
      }
      offen = { tag, kind };
      zeichnePaeckchen();
      dlgP.showModal();
      return;
    }
    if (b.matches("[data-zu]")) { dlgP.close(); return; }
    if (b.dataset.legen) { legen(offen.tag, offen.kind, b.dataset.legen); return; }
    if (b.dataset.nehmen) { nehmen(b.dataset.nehmen); return; }
  });

  sektion.addEventListener("change", (ev) => {
    const i = ev.target.closest("[data-notiz]");
    if (!i) return;
    const e = stand.kette.find((x) => x.id === i.dataset.notiz);
    if (!e) return;
    const notiz = i.value.trim().slice(0, 80) || null;
    if (notiz === e.notiz) return;
    aendern(() => { e.notiz = notiz; }, () => speicher.notiz(e.id, notiz));
  });

  dlgP.addEventListener("close", () => { offen = null; });
  // Klick auf den abgedunkelten Rand schließt die Dialoge.
  for (const d of [dlgP, dlgD]) d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); });

  // Der andere Elternteil trägt vielleicht gleichzeitig ein: beim Zurückkommen und jede halbe Minute neu holen.
  const ruhig = () => !dlgP.open && !dlgD.open;
  const sichtbar = () => { if (document.visibilityState === "visible" && ruhig()) neuLaden(); };
  document.addEventListener("visibilitychange", sichtbar);
  const takt = setInterval(() => { if (document.visibilityState === "visible" && ruhig()) neuLaden(); }, 30000);

  zeichnen();
  const heute = heutigerTag();
  if (heute && heute > 3) el(`.glied[data-tag="${heute}"]`)?.scrollIntoView({ block: "center" });

  return () => {
    document.removeEventListener("visibilitychange", sichtbar);
    clearInterval(takt);
  };
}
