import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { drone } from '~/audio/drone';
import { setVolume, type Channel } from '~/audio/engine';
import { metronome } from '~/audio/metronome';
import { song } from '~/audio/song';
import { describeDrone } from '~/core/drone';
import { describeRhythm } from '~/core/rhythm';
import { RISK_NAMES, type Risk } from '~/core/roll';
import { Fader } from '~/shared/Fader';
import { useSettings } from '~/shared/settings';
import { useSong } from '~/shared/song';
import { Button, Segmented, Stepper } from '~/shared/ui/ui';
import styles from './shell.module.css';

const SECTIONS: ReadonlyArray<{ label: string; to: string; end?: boolean }> = [
  { label: 'Consigna', to: '/consigna' },
  { label: 'Estudio', to: '/estudio' },
  { label: 'Afinador', to: '/afinador' },
  { label: 'Ritmo', to: '/ritmo' },
  { label: 'Drone', to: '/drone' },
  { label: 'Armonía', to: '/armonia' },
  { label: 'Melodía', to: '/melodia' },
  { label: 'Letras', to: '/letras' },
  { label: 'Cartas', to: '/cartas' },
  { label: 'Forma', to: '/forma' },
  { label: 'Diario', to: '/diario' },
];

function Navigation() {
  const notation = useSettings((s) => s.notation);
  const a4 = useSettings((s) => s.a4);
  const set = useSettings((s) => s.set);
  return (
    <>
      <ul className={styles.navList}>
        {SECTIONS.map((section, index) => (
          <li key={section.label}>
            <NavLink
              to={section.to}
              end={section.end}
              className={styles.navItem}
              aria-label={section.label}
              title={section.label}
            >
              <span className={styles.navNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.navLabel}>{section.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className={styles.navSettings}>
        <Fader channel="master" />
        <Segmented
          label="Nombres de las notas"
          value={notation}
          stretch
          options={[
            { value: 'letters', label: 'E A D' },
            { value: 'solfege', label: 'Mi La Re' },
          ]}
          onChange={(value) => set({ notation: value })}
        />
        <Stepper
          label="referencia del La"
          value={`La ${a4} Hz`}
          onDown={() => set({ a4: Math.max(415, a4 - 1) })}
          onUp={() => set({ a4: Math.min(466, a4 + 1) })}
        />
      </div>
    </>
  );
}

/** Qué tan lejos sortea cada herramienta. Siempre está en el mismo lugar. */
function RiskBar() {
  const risk = useSettings((s) => s.risk);
  const set = useSettings((s) => s.set);
  return (
    <div className={styles.riskBar}>
      <label className={styles.riskPicker}>
        <span className={styles.axisLabel}>
          Seguro ↔ raro: <strong>{RISK_NAMES[risk]}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={risk}
          aria-valuetext={RISK_NAMES[risk]}
          onChange={(event) => set({ risk: Number(event.target.value) as Risk })}
        />
      </label>
    </div>
  );
}

/**
 * Lo que empezó a sonar queda acá abajo en cualquier pantalla. Parar solo lo silencia, para poder
 * volver a tocarlo; la X es lo que lo saca de la barra.
 */
function Dock({ inStudio }: { inStudio: boolean }) {
  const songState = useSyncExternalStore(song.subscribe, song.getState, song.getState);
  const clock = useSyncExternalStore(metronome.subscribe, metronome.getState, metronome.getState);
  const held = useSyncExternalStore(drone.subscribe, drone.getState, drone.getState);
  const dock = useRef<HTMLDivElement>(null);
  // En el Estudio el tema se maneja desde su transporte: repetirlo acá solo quitaría pantalla.
  const songRow = songState.running && !inStudio;
  const visible = clock.docked || held.docked || songRow;

  // El botón de la consigna se pega arriba de esta barra: necesita saber cuánto mide.
  useEffect(() => {
    const element = dock.current;
    const root = document.documentElement;
    if (!element) {
      root.style.setProperty('--dock-h', '0px');
      return;
    }
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--dock-h', `${element.offsetHeight}px`);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.setProperty('--dock-h', '0px');
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div ref={dock} className={styles.dock}>
      {songRow && (
        <div className={styles.dockRow} data-testid="dock-estudio" data-running="true">
          <Button variant="mini" onClick={() => song.stop()} ariaLabel="Parar el tema">
            ■ Parar
          </Button>
          <div className={styles.dockMiddle}>
            <div className={styles.dockLabel}>
              <Link to="/estudio">Suena el tema del Estudio</Link>
            </div>
          </div>
        </div>
      )}
      {clock.docked && (
        <div className={styles.dockRow} data-testid="dock-ritmo" data-running={clock.running}>
          <Button
            variant="mini"
            onClick={() => (clock.running ? metronome.stop() : metronome.start())}
            ariaLabel={clock.running ? 'Parar el ritmo' : 'Tocar el ritmo'}
          >
            {clock.running ? '■ Parar' : '▶ Tocar'}
          </Button>
          <div className={styles.dockMiddle}>
            <div className={styles.dockLabel}>
              <Link to="/ritmo">{describeRhythm(clock.config).label}</Link>
            </div>
            <Fader channel="ritmo" compact />
          </div>
          <Button variant="mini" onClick={() => metronome.close()} ariaLabel="Cerrar el ritmo">
            ✕
          </Button>
        </div>
      )}
      {held.docked && (
        <div className={styles.dockRow} data-testid="dock-drone" data-running={held.running}>
          <Button
            variant="mini"
            onClick={() => (held.running ? drone.stop() : drone.start())}
            ariaLabel={held.running ? 'Parar el drone' : 'Sostener el drone'}
          >
            {held.running ? '■ Parar' : '▶ Sostener'}
          </Button>
          <div className={styles.dockMiddle}>
            <div className={styles.dockLabel}>
              <Link to="/drone">{describeDrone(held.config).label}</Link>
            </div>
            <Fader channel="drone" compact />
          </div>
          <Button variant="mini" onClick={() => drone.close()} ariaLabel="Cerrar el drone">
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}

/** Mientras suena el tema, lo que cambie en cualquier herramienta llega al motor. */
function SongSync() {
  const plan = useSong();
  useEffect(() => song.setPlan(plan), [plan]);
  return null;
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const clickSound = useSettings((s) => s.clickSound);
  const volumes = useSettings((s) => s.volumes);
  const a4 = useSettings((s) => s.a4);
  const set = useSettings((s) => s.set);
  const { pathname } = useLocation();
  const inStudio = pathname.startsWith('/estudio');
  const songRunning = useSyncExternalStore(song.subscribe, () => song.getState().running, () => false);

  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  // El audio no conoce las preferencias: se las pasa el marco de la app.
  useEffect(() => {
    drone.setReferencePitch(a4);
    metronome.setSound(clickSound);
    (Object.keys(volumes) as Channel[]).forEach((channel) => setVolume(channel, volumes[channel]));
  }, [a4, clickSound, volumes]);

  // Abierto, el menú ocupa toda la pantalla: se cierra al navegar o con Esc.
  useEffect(() => {
    setMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- reacciona a la navegación
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add(styles.noScroll!);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove(styles.noScroll!);
    };
  }, [menuOpen]);

  return (
    <div className={styles.shell} data-collapsed={collapsed} data-fit={inStudio}>
      {songRunning && <SongSync />}
      <header className={styles.topBar}>
        <Link to="/" className={styles.brand}>
          Scordatura
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </header>

      <nav id="main-nav" className={styles.nav} data-open={menuOpen} aria-label="Herramientas">
        <div className={styles.railHead}>
          <Link to="/" className={styles.railBrand} aria-label="Scordatura">
            <span className={styles.railBrandFull}>Scordatura</span>
            <span className={styles.railBrandShort} aria-hidden="true">
              S
            </span>
          </Link>
          <button
            type="button"
            className={styles.collapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir la barra lateral' : 'Colapsar la barra lateral'}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            onClick={() => set({ sidebarCollapsed: !collapsed })}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <Navigation />
      </nav>

      <div className={styles.column}>
        {pathname !== '/' && <RiskBar />}
        <main className={styles.main}>
          <Outlet />
        </main>
        <Dock inStudio={inStudio} />
      </div>
    </div>
  );
}
