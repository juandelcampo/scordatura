// La consigna envuelve a las herramientas. Abiertas desde ella, se ven encima, en un modal, y la
// consigna sigue montada detrás: lo que se elige en la herramienta se ve llegar a su tarjeta.
import { useEffect, useRef, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { RiskPicker } from '~/shared/RiskPicker';
import { isToolPath, toolName, useToolModal } from '~/shared/toolModal';
import { Button } from '~/shared/ui/ui';
import { ConsignaView } from './ConsignaView';
import styles from './toolModal.module.css';

/** Esc, el fondo o "Volver" la cierran; "Pantalla completa" la deja abierta como página. */
function ToolModal({
  title,
  onClose,
  onExpand,
  children,
}: {
  title: string;
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
      data-testid="tool-modal"
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
        <Button variant="mini" onClick={onClose} id="tool-close">
          ✕ Volver a la consigna
        </Button>
      </div>
      <div className={styles.toolBody}>{children}</div>
    </dialog>
  );
}

export default function ConsignaLayout() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname.replace(/\/+$/, '') || '/';
  const from = useToolModal((s) => s.from);
  const modal = from !== null && isToolPath(pathname);
  const onConsigna = pathname === '/' || pathname === '/consigna' || modal;

  const close = () => {
    const { depth, from: origin } = useToolModal.getState();
    // Deshace los pasos de la herramienta: "Atrás" después de cerrar no la vuelve a abrir.
    if (depth > 0) void navigate(-depth);
    else void navigate(origin ?? '/');
  };

  // Siempre la misma forma, para que la consigna no se vuelva a montar al abrir o cerrar el modal.
  return (
    <>
      {onConsigna && <ConsignaView background={modal} />}
      {modal ? (
        <ToolModal
          title={toolName(pathname)}
          onClose={close}
          onExpand={() => useToolModal.getState().clear()}
        >
          <Outlet />
        </ToolModal>
      ) : (
        !onConsigna && <Outlet />
      )}
    </>
  );
}
