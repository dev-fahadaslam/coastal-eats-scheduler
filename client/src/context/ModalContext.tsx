import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ModalState {
  content: ReactNode;
  onClose?: () => void;
}

interface ModalContextValue {
  openModal: (content: ReactNode, onClose?: () => void) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stateRef = useRef<ModalState | null>(null);
  stateRef.current = state;

  const openModal = useCallback((content: ReactNode, onClose?: () => void) => {
    setState({ content, onClose });
    setModalKey(k => k + 1);
  }, []);

  const closeModal = useCallback(() => {
    stateRef.current?.onClose?.();
    setState(null);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [state]);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <dialog key={modalKey} ref={dialogRef} className="modal-enter" onClose={closeModal}>
        <button className="close" aria-label="Close" onClick={closeModal}>×</button>
        {state?.content}
      </dialog>
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
