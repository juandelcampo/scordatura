// Arrastrar y soltar con el puntero: anda igual con el mouse y con el dedo. Lo que se arrastra lleva
// un `group`; donde se suelta son los elementos con `dropTarget(group, índice)`. Mientras se arrastra,
// el lugar de destino se marca con una raya naranja del lado donde va a entrar, y lo de origen queda
// tenue. Con el dedo hay que mantener apretado un momento: si no, el gesto es para desplazarse.
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface DragSpec {
  /** Qué destinos acepta: los que tengan el mismo grupo. */
  group: string;
  /** Lo que se ve pegado al puntero. */
  label: string;
  /** Si la lista va a lo ancho (antes = izquierda) o a lo alto (antes = arriba). */
  axis?: 'x' | 'y';
  /** `index` es el destino; `after`, si se soltó en su segunda mitad. */
  onDrop: (index: number, after: boolean) => void;
}

const THRESHOLD = 5;
const HOLD_MS = 280;
const SLOP = 8;

/** Para el elemento donde se puede soltar. */
export const dropTarget = (group: string, index: number) => ({
  'data-drop': group,
  'data-drop-index': index,
});

/** Dónde entra lo soltado: antes o después del destino. */
export const insertionIndex = (index: number, after: boolean) => index + (after ? 1 : 0);

/** Para mover algo de la misma lista: el lugar que ocupa después de sacarlo de donde estaba. */
export const reorderTo = (from: number, insertAt: number) => (insertAt > from ? insertAt - 1 : insertAt);

const isField = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');

/** Un clic que llega justo al soltar no es un clic: si no, soltar un acorde lo elegiría. */
export function swallowNextClick() {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}

/** El `onPointerDown` de algo que se puede arrastrar. Los clics comunes siguen andando. */
export function draggable<E extends HTMLElement>(spec: DragSpec | (() => DragSpec | null)) {
  return (event: ReactPointerEvent<E>) => {
    if (event.button !== 0 || isField(event.target)) return;
    const source = event.currentTarget;
    const touch = event.pointerType !== 'mouse';
    const startX = event.clientX;
    const startY = event.clientY;
    const pointer = event.pointerId;
    let current: DragSpec | null = null;
    let active = false;
    let ghost: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    let after = false;
    let hold: ReturnType<typeof setTimeout> | null = null;
    let moved = false;
    let edge = 0;
    let frame = 0;
    let lastX = startX;
    let lastY = startY;

    const mark = (next: HTMLElement | null, nextAfter: boolean) => {
      if (target && (target !== next || after !== nextAfter)) target.removeAttribute('data-drop-side');
      target = next;
      after = nextAfter;
      if (!target || !current) return;
      const axis = current.axis ?? 'x';
      target.setAttribute(
        'data-drop-side',
        axis === 'x' ? (after ? 'right' : 'left') : after ? 'bottom' : 'top',
      );
    };

    const begin = () => {
      current = typeof spec === 'function' ? spec() : spec;
      if (!current) return finish();
      active = true;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = current.label;
      document.body.append(ghost);
      document.documentElement.setAttribute('data-dragging', current.group);
      source.setAttribute('data-drag-source', '');
      window.getSelection()?.removeAllRanges();
      navigator.vibrate?.(10);
    };

    // Cerca del borde de arriba o de abajo, la página se desplaza sola: así se llega a lo que no se ve.
    const scroll = () => {
      frame = 0;
      if (!active || edge === 0) return;
      window.scrollBy(0, edge);
      follow(lastX, lastY);
      frame = requestAnimationFrame(scroll);
    };

    const follow = (x: number, y: number) => {
      if (!ghost || !current) return;
      lastX = x;
      lastY = y;
      const zone = 48;
      edge = y < zone ? -10 : y > window.innerHeight - zone ? 10 : 0;
      if (edge !== 0 && !frame) frame = requestAnimationFrame(scroll);
      ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
      const under = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>(`[data-drop="${CSS.escape(current.group)}"]`);
      if (!under) return mark(null, false);
      const box = under.getBoundingClientRect();
      const axis = current.axis ?? 'x';
      mark(under, axis === 'x' ? x > box.left + box.width / 2 : y > box.top + box.height / 2);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!active) {
        if (touch) {
          // Se movió antes de tiempo: quería desplazarse.
          if (distance > SLOP) finish();
          return;
        }
        if (distance < THRESHOLD) return;
        begin();
      }
      if (distance > SLOP) moved = true;
      follow(e.clientX, e.clientY);
    };

    // Con el dedo, mantener apretado también abre el menú: si no se movió, gana el menú.
    const menu = (e: Event) => {
      if (!active) return;
      if (!moved) return finish();
      e.preventDefault();
      e.stopPropagation();
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (active && current) {
        swallowNextClick();
        const spot = target;
        const side = after;
        const drop = current.onDrop;
        finish();
        if (spot) drop(Number(spot.dataset.dropIndex), side);
        return;
      }
      finish();
    };

    // Mientras se arrastra con el dedo, la página no se desplaza.
    const blockScroll = (e: TouchEvent) => {
      if (active) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && active) {
        e.preventDefault();
        swallowNextClick();
        finish();
      }
    };

    function finish() {
      if (hold) clearTimeout(hold);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      mark(null, false);
      ghost?.remove();
      ghost = null;
      if (active) {
        document.documentElement.removeAttribute('data-dragging');
        source.removeAttribute('data-drag-source');
      }
      active = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('contextmenu', menu, true);
    }
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === pointer) finish();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('keydown', key, true);
    window.addEventListener('contextmenu', menu, true);
    if (touch) {
      hold = setTimeout(() => {
        begin();
        follow(startX, startY);
      }, HOLD_MS);
    }
  };
}
