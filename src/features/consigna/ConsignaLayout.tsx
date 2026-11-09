// La consigna envuelve a las herramientas. Abiertas desde ella, se ven encima, en un modal, y la
// consigna sigue montada detrás: lo que se elige en la herramienta se ve llegar a su tarjeta.
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Outlet, useLocation, useMatches, useNavigate, useNavigationType, useOutlet } from 'react-router';
import { RiskPicker } from '~/shared/RiskPicker';
import { isToolPath, levelName, stackAfter, toolName, useToolModal } from '~/shared/toolModal';
import { Button } from '~/shared/ui/ui';
import { ConsignaView } from './ConsignaView';
import styles from './toolModal.module.css';

/**
 * Las hojas de estilo de una ruta, según el manifiesto de React Router. Hacen falta para la
 * herramienta de abajo: React Router solo enlaza las de la ruta actual, y en el build cada pantalla
 * trae su CSS aparte.
 */
function routeCss(routeId: string | undefined): string[] {
  if (!routeId || typeof window === 'undefined') return [];
  const manifest = (window as { __reactRouterManifest?: { routes?: Record<string, { css?: unknown }> } })
    .__reactRouterManifest;
  const css = manifest?.routes?.[routeId]?.css;
  return Array.isArray(css) ? css.filter((href): href is string => typeof href === 'string') : [];
}

/** Esc, el fondo o "Volver" la cierran; "Pantalla completa" la deja abierta como página. */
function ToolModal({
  title,
  level,
  closeLabel,
  onClose,
  onExpand,
  children,
}: {
  title: string;
  /** 0 es el de la consigna; los de arriba se abren desde otra herramienta. */
  level: number;
  closeLabel: string;
  onClose: () => void;
  onExpand: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    document.documentElement.classList.add(styles.noScroll!);
    return () => {
      element?.close();
      document.documentElement.classList.remove(styles.noScroll!);
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.toolModal}
      aria-label={title}
      data-level={level}
      data-testid={level === 0 ? 'tool-modal' : `tool-modal-${level + 1}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.toolBar}>
        <span className={styles.toolTitle}>{title}</span>
        <div className={styles.toolRisk}>
          <RiskPicker />
        </div>
        <Button variant="mini" onClick={onExpand}>
          Pantalla completa
        </Button>
        <Button variant="mini" onClick={onClose} id={level === 0 ? 'tool-close' : `tool-close-${level + 1}`}>
          ✕ {closeLabel}
        </Button>
      </div>
      <div className={styles.toolBody}>{children}</div>
    </dialog>
  );
}

export default function ConsignaLayout() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname.replace(/\/+$/, '') || '/';
  const outlet = useOutlet();
  const navigationType = useNavigationType();
  const from = useToolModal((s) => s.from);
  const base = useToolModal((s) => s.base);
  const depth = useToolModal((s) => s.depth);
  const saved = useToolModal((s) => s.levels);
  const modal = from !== null && isToolPath(pathname);
  // La pila tal como queda con esta navegación; el store la guarda después, en un efecto del marco.
  const levels = modal
    ? stackAfter({ base, depth, levels: saved }, pathname, navigationType === 'PUSH').levels
    : [];
  const onConsigna = pathname === '/' || pathname === '/consigna' || modal;
  const stack = modal ? Math.max(1, levels.length) : 0;

  // La de arriba es la de la URL. Las de abajo siguen montadas con lo que mostraban, así al cerrar
  // la de arriba se vuelve a la de abajo tal como estaba.
  const routeId = useMatches().at(-1)?.id;
  const shown = useRef<Array<{ element: ReactElement | null; routeId: string | undefined }>>([]);
  /* eslint-disable react-hooks/refs -- guarda la herramienta de abajo para que no se desmonte: se
     lee y se escribe en el render a propósito, hasta el final del archivo */
  if (stack > 0) {
    shown.current = [...shown.current.slice(0, stack - 1), { element: outlet, routeId }];
  } else {
    shown.current = [];
  }
  const elements = shown.current;

  const close = () => {
    const { depth, from: origin } = useToolModal.getState();
    // Deshace los pasos de la herramienta: "Atrás" después de cerrar no la vuelve a abrir.
    if (depth > 0) void navigate(-depth);
    else void navigate(origin ?? '/');
  };
  /** Cierra solo la de arriba: deshace sus pasos y vuelve a la de abajo. */
  const closeTop = () => {
    const { depth, levels: open } = useToolModal.getState();
    const top = open[open.length - 1];
    if (!top || open.length < 2) close();
    else void navigate(-(depth - top.at));
  };

  // Siempre la misma forma, para que la consigna no se vuelva a montar al abrir o cerrar el modal.
  return (
    <>
      {onConsigna && <ConsignaView background={modal} />}
      {modal
        ? elements.map(({ element, routeId: id }, level) => (
            <ToolModal
              key={level}
              level={level}
              title={levels[level] ? levelName(levels[level]) : toolName(pathname)}
              closeLabel={level === 0 ? 'Volver a la consigna' : `Volver a ${levelName(levels[level - 1])}`}
              onClose={level === 0 ? close : closeTop}
              onExpand={() => useToolModal.getState().clear()}
            >
              {level < elements.length - 1 &&
                routeCss(id).map((href) => <link key={href} rel="stylesheet" href={href} />)}
              {element}
            </ToolModal>
          ))
        : !onConsigna && <Outlet />}
    </>
  );
}
/* eslint-enable react-hooks/refs */
