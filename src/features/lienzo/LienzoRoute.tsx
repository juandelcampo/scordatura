// El lienzo: una canción por proyecto, con la consigna arriba proponiendo y chequeando. Ocupa toda la
// pantalla: el menú ≡ lleva a la Consigna, el Diario y las Herramientas.
import { useEffect, useMemo } from 'react';
import { encodeConsigna, consignaNumber } from '~/core/consigna';
import { lienzoPlayer } from '~/audio/lienzo';
import { secAtBar } from '~/core/lienzo/schedule';
import { useConsigna } from '~/shared/consigna';
import { useHydrated } from '~/shared/useHydrated';
import { useLienzo } from '~/shared/lienzo';
import { useLienzoUi } from '~/shared/lienzoUi';
import { useProject } from '~/shared/project';
import { useSettings } from '~/shared/settings';
import { Canvas } from './Canvas';
import { ContextMenu, Header, Menu, Strip, togglePlay } from './Chrome';
import { LetraWin } from './LetraWin';
import { ModelContext, projectFromConsigna, rowTexts, type Model } from './model';
import { cachedRules } from './plan';
import { Reglas } from './Reglas';
import { Hoja, Instrumento, Referencias } from './Views';
import { Acordes, Circulo, Ritmo, Tonalidad } from './Windows';
import s from './lienzo.module.css';

export function meta() {
  return [
    { title: 'Lienzo · Scordatura' },
    {
      name: 'description',
      content:
        'Una canción por proyecto: armonía, melodía, ritmo y letra por sección, con la consigna al lado.',
    },
  ];
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

/** Las tipografías se piden después de montar: sin red, no frenan nada y queda la del sistema. */
function useFonts() {
  useEffect(() => {
    const add = () => {
      if (document.querySelector(`link[href="${FONTS}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS;
      document.head.appendChild(link);
    };
    // Después del load: si la red no responde, la página igual termina de cargar.
    if (document.readyState === 'complete') add();
    else window.addEventListener('load', add, { once: true });
    return () => window.removeEventListener('load', add);
  }, []);
}

/** Mientras suena, la selección y la letra siguen a la sección que se oye. */
function useFollow() {
  useEffect(() => {
    let last: string | null = null;
    const timer = setInterval(() => {
      const ui = useLienzoUi.getState();
      const p = useLienzo.getState().project;
      if (!p || !ui.follow || !lienzoPlayer.isPlaying()) {
        last = null;
        return;
      }
      const at = secAtBar(p.secs, Math.floor(lienzoPlayer.position()));
      if (!at || at.sec.id === last) return;
      last = at.sec.id;
      if (!ui.sel.take) ui.select({ sec: ui.sel.lane === 'letra' ? at.sec.id : (at.sec.of ?? at.sec.id) });
      const lyric = p.clips[`letra:${at.sec.id}`];
      if (lyric) ui.set({ lyricInst: lyric });
    }, 120);
    return () => clearInterval(timer);
  }, []);
}

function Lienzo() {
  const project = useLienzo((st) => st.project)!;
  const consigna = useConsigna((st) => st.consigna);
  const a4 = useSettings((st) => st.a4);
  const risk = useSettings((st) => st.risk);
  const ui = useLienzoUi();
  const update = useLienzo((st) => st.update);
  useFollow();

  // El proyecto recuerda con qué consigna se trabaja.
  useEffect(() => {
    const code = encodeConsigna(consigna);
    if (project.consigna !== code) update(() => ({ consigna: code }));
  }, [consigna, project.consigna, update]);

  useEffect(() => () => lienzoPlayer.pause(), []);

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === ' ' && !el.closest('input, textarea, button, [role="slider"]')) {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'Escape') useLienzoUi.getState().set({ ctx: null, menu: false });
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);

  const model = useMemo<Model>(() => {
    const rows = rowTexts(consigna);
    const { parts, rules, meter } = cachedRules(consigna);
    const found = project.secs.find((x) => x.id === ui.sel.sec) ?? project.secs[0]!;
    const selSec =
      found.of && ui.sel.lane !== 'letra' ? (project.secs.find((x) => x.id === found.of) ?? found) : found;
    return {
      project,
      rules,
      consigna,
      parts,
      rows,
      meter,
      number: consignaNumber(consigna),
      a4,
      risk,
      selSec,
      guitar: project.instrument === 'guitarra',
    };
  }, [project, consigna, a4, risk, ui.sel.sec, ui.sel.lane]);

  return (
    <ModelContext.Provider value={model}>
      <div
        className={s.root}
        data-lienzo
        data-theme={ui.theme}
        onPointerDown={(e) => {
          if ((ui.ctx || ui.menu) && !(e.target as HTMLElement).closest('[data-ctx]'))
            ui.set({ ctx: null, menu: false });
        }}
      >
        <Header />
        <Strip />
        {ui.view === 'lienzo' && <Canvas />}
        {ui.view === 'hoja' && <Hoja />}
        {ui.view === 'instrumento' && <Instrumento />}
        {ui.view === 'refs' && <Referencias />}
        <Tonalidad />
        <Circulo />
        <Ritmo />
        <LetraWin />
        <Acordes />
        <Reglas />
        <Menu />
        <ContextMenu />
      </div>
    </ModelContext.Provider>
  );
}

export default function LienzoRoute() {
  const hydrated = useHydrated();
  const project = useLienzo((st) => st.project);
  const load = useLienzo((st) => st.load);
  const consigna = useConsigna((st) => st.consigna);
  useFonts();

  // Sin proyecto, se arma uno desde la consigna y lo que ya había en el Estudio.
  useEffect(() => {
    if (hydrated && !project) {
      const p = projectFromConsigna(consigna, useProject.getState().sections);
      load(p);
      useLienzoUi.getState().select({ sec: p.secs[0]!.id, take: null });
    }
  }, [hydrated, project, consigna, load]);

  if (!hydrated || !project) return <p style={{ padding: 16 }}>Cargando el lienzo…</p>;
  return <Lienzo />;
}
