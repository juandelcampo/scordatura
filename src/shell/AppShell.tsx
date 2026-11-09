import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router';
import { drone } from '~/audio/drone';
import { setVolume, type Channel } from '~/audio/engine';
import { metronome } from '~/audio/metronome';
import { song } from '~/audio/song';
import { describeDrone } from '~/core/drone';
import { describeRhythm } from '~/core/rhythm';
import { Fader } from '~/shared/Fader';
import { RiskPicker } from '~/shared/RiskPicker';
import { useSettings } from '~/shared/settings';
import { useSong } from '~/shared/song';
import { isToolPath, useToolModal } from '~/shared/toolModal';
import { Button, Segmented, Stepper } from '~/shared/ui/ui';
import styles from './shell.module.css';

// Una sesión tiene un solo camino: se sortea, se toca y queda en el Diario. Lo demás cuelga de ahí.
const SECTIONS: ReadonlyArray<{ label: string; to: string; routes: readonly string[] }> = [
  { label: 'Sorteo', to: '/', routes: ['/consigna', '/estudio', '/cartas'] },
  { label: 'Diario', to: '/diario', routes: [] },
  {
    label: 'Herramientas',
    to: '/herramientas',
    routes: ['/afinador', '/ritmo', '/drone', '/armonia', '/melodia', '/letras', '/forma'],
  },
];

/** Acá no se sortea nada: el slider de riesgo no haría nada. */
const NO_RISK: readonly string[] = ['/acerca', '/herramientas', '/diario'];

const inRoute = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

function Navigation({ pathname }: { pathname: string }) {
  const notation = useSettings((s) => s.notation);
  const a4 = useSettings((s) => s.a4);
  const set = useSettings((s) => s.set);
  return (
    <>
      <ul className={styles.navList}>
        {SECTIONS.map((section, index) => (
          <li key={section.label}>
            <Link
              to={section.to}
              className={styles.navItem}
              aria-label={section.label}
              aria-current={
                pathname === section.to || section.routes.some((route) => inRoute(pathname, route))
                  ? 'page'
                  : undefined
              }
              title={section.label}
            >
              <span className={styles.navNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.navLabel}>{section.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.navSettings}>
        <Link to="/acerca" className={styles.about}>
          Qué es Scordatura
        </Link>
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

/** El camino de vuelta, y qué tan lejos sortea la herramienta. En la consigna, el riesgo va junto a sortear. */
function RiskBar() {
  return (
    <div className={styles.riskBar}>
      <Link to="/" className={styles.backToConsigna}>
        ← Consigna
      </Link>
      <div className={styles.riskPicker}>
        <span className={styles.axisLabel} aria-hidden="true">
          Riesgo
        </span>
        <RiskPicker />
      </div>
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
  // Las páginas estáticas se generan con la barra final (/acerca/): sin esto, el HTML no coincide.
  const location = useLocation();
  const navigationType = useNavigationType();
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const inStudio = pathname.startsWith('/estudio');
  const toolFrom = useToolModal((s) => s.from);
  // Abierta desde la consigna, la herramienta va encima de ella; si se llegó directo, es una página.
  const modal = toolFrom !== null && isToolPath(pathname);
  const onConsigna = pathname === '/' || pathname === '/consigna' || modal;
  // Letras también entra entera en una pantalla de escritorio: cada panel se desplaza adentro.
  const fitsScreen = pathname.startsWith('/letras');
  // Para la navegación, el modal sigue siendo la consigna.
  const navPathname = modal ? '/' : pathname;
  const songRunning = useSyncExternalStore(
    song.subscribe,
    () => song.getState().running,
    () => false,
  );

  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  // El audio no conoce las preferencias: se las pasa el marco de la app.
  useEffect(() => {
    drone.setReferencePitch(a4);
    metronome.setSound(clickSound);
    (Object.keys(volumes) as Channel[]).forEach((channel) => setVolume(channel, volumes[channel]));
  }, [a4, clickSound, volumes]);

  // Se cuentan los pasos que la herramienta agrega al historial, para que cerrarla los deshaga.
  useEffect(() => {
    const store = useToolModal.getState();
    if (store.from === null) return;
    if (!isToolPath(pathname)) store.clear();
    else if (navigationType === 'PUSH') store.step(1);
    else if (navigationType === 'POP') store.step(-1);
  }, [location.key, pathname, navigationType]);

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
    <div
      className={styles.shell}
      data-collapsed={collapsed}
      data-fit={inStudio ? 'true' : onConsigna ? 'consigna' : fitsScreen ? 'pantalla' : 'false'}
    >
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

      <nav id="main-nav" className={styles.nav} data-open={menuOpen} aria-label="Principal">
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
        <Navigation pathname={navPathname} />
      </nav>

      <div className={styles.column}>
        {!NO_RISK.includes(pathname) && !onConsigna && <RiskBar />}
        <main className={styles.main}>
          <Outlet />
        </main>
        <Dock inStudio={inStudio} />
      </div>
    </div>
  );
}
