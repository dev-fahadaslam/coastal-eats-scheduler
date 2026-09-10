import { useModal } from '../context/ModalContext.js';

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const { openModal, closeModal } = useModal();

  return function confirm({ title, body, confirmLabel = 'Confirm', danger = false }: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      let resolved = false;
      const settle = (result: boolean) => { resolved = true; resolve(result); };
      openModal(
        <div>
          <p className="eyebrow">PLEASE CONFIRM</p>
          <h2>{title}</h2>
          <p className="sub">{body}</p>
          <div className="modal-actions">
            <button className="ghost" onClick={() => { settle(false); closeModal(); }}>Cancel</button>
            <button className={danger ? 'danger-btn' : 'primary'} onClick={() => { settle(true); closeModal(); }}>{confirmLabel}</button>
          </div>
        </div>,
        () => { if (!resolved) resolve(false); },
      );
    });
  };
}
