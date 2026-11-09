// El clic derecho: un menú chico con lo que se puede hacer sobre la cosa tocada. Hay uno solo en la
// app; cada elemento le pasa sus opciones. Lo de adentro manda: el menú de un acorde tapa el de
// su tarjeta. En los campos de texto queda el menú del navegador, para copiar y pegar.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { create } from 'zustand';
import styles from './ui/contextMenu.module.css';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Para los que se prenden y apagan, como "Trabar". */
  checked?: boolean;
}
/** `null` es una raya entre grupos; `false`, `''` y `undefined` se saltean, para armar la lista con `&&`. */
export type MenuItem = MenuAction | null | false | '' | undefined;

interface MenuState {
  open: { x: number; y: number; title?: string; items: (MenuAction | null)[] } | null;
  show: (x: number, y: number, items: MenuItem[], title?: string) => void;
  close: () => void;
}

/** Saca los vacíos y las rayas sobrantes (al principio, al final o dos seguidas). */
function tidy(items: MenuItem[]): (MenuAction | null)[] {
  const out: (MenuAction | null)[] = [];
  for (const item of items) {
    if (item === false || item === undefined || item === '') continue;
    if (item === null && (out.length === 0 || out[out.length - 1] === null)) continue;
    out.push(item);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

const useMenu = create<MenuState>()((set) => ({
  open: null,
  show: (x, y, items, title) => {
    const list = tidy(items);
    set({ open: list.length ? { x, y, items: list, ...(title ? { title } : {}) } : null });
  },
  close: () => set({ open: null }),
}));

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest('input:not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select');

/**
 * Para `onContextMenu`: arma las opciones recién al abrir, así siempre están al día. Si hay texto
 * elegido o se toca un campo de texto, deja el menú del navegador.
 */
export function contextMenu<E extends Element>(
  items: (element: E) => MenuItem[],
  title?: string | (() => string),
) {
  return (event: ReactMouseEvent<E>) => {
    if (isTextField(event.target)) return;
    if (window.getSelection()?.toString()) return;
    event.preventDefault();
    event.stopPropagation();
    // Con el teclado (tecla de menú o Shift+F10) no hay puntero: se abre debajo del elemento.
    let { clientX: x, clientY: y } = event;
    if (x === 0 && y === 0) {
      const box = event.currentTarget.getBoundingClientRect();
      x = box.left + 8;
      y = box.bottom;
    }
    useMenu.getState().show(x, y, items(event.currentTarget), typeof title === 'function' ? title() : title);
  };
}

/** Doble clic sobre algo que no sea un control: los botones de adentro siguen siendo de un clic. */
export function onFreeDoubleClick<E extends Element>(action: () => void) {
  return (event: ReactMouseEvent<E>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, label, [role="button"]')) return;
    window.getSelection()?.removeAllRanges();
    action();
  };
}

const MARGIN = 8;

/** Va una vez, en el shell. */
export function ContextMenuHost() {
  const open = useMenu((s) => s.open);
  const close = useMenu((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const opener = useRef<Element | null>(null);

  // Que no se salga de la pantalla: si no entra a la derecha o abajo, se abre para el otro lado.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!open || !menu) {
      setPlace(null);
      return;
    }
    const { width, height } = menu.getBoundingClientRect();
    const left = open.x + width + MARGIN > window.innerWidth ? Math.max(MARGIN, open.x - width) : open.x;
    const top = open.y + height + MARGIN > window.innerHeight ? Math.max(MARGIN, open.y - height) : open.y;
    setPlace({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const away = (event: Event) => {
      if (ref.current && event.target instanceof Node && ref.current.contains(event.target)) return;
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        (opener.current as HTMLElement | null)?.focus?.();
      }
    };
    // En captura: el clic afuera cierra antes de que lo tome otro elemento.
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close);
      window.removeEventListener('blur', close);
    };
  }, [open, close]);

  if (!open) return null;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const go = (index: number) => buttons[(index + buttons.length) % buttons.length]?.focus();
    if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(buttons.length - 1);
    else if (event.key === 'Tab') close();
    else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  return (
    <div
      ref={ref}
      className={styles.menu}
      role="menu"
      aria-label={open.title ?? 'Opciones'}
      data-testid="context-menu"
      data-print="hide"
      style={
        place ? { left: place.left, top: place.top } : { left: open.x, top: open.y, visibility: 'hidden' }
      }
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {open.title && <p className={styles.title}>{open.title}</p>}
      {open.items.map((item, index) =>
        item === null ? (
          <hr key={`sep-${index}`} className={styles.sep} />
        ) : (
          <button
            key={`${item.label}-${index}`}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
