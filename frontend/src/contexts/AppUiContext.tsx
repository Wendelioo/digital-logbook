import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { Notification } from '../components/Badge';

export type AppToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface AppConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface AppUiContextValue {
  toast: (message: string, variant?: AppToastVariant) => void;
  confirm: (options: AppConfirmOptions) => Promise<boolean>;
}

const AppUiContext = createContext<AppUiContextValue | null>(null);

export function useAppUi(): AppUiContextValue {
  const ctx = useContext(AppUiContext);
  if (!ctx) {
    throw new Error('useAppUi must be used within AppUiProvider');
  }
  return ctx;
}

type ToastState = { message: string; variant: AppToastVariant } | null;

export function AppUiProvider({ children }: { children: React.ReactNode }) {
  const [toastState, setToastState] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirmState, setConfirmState] = useState<AppConfirmOptions | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const toast = useCallback((message: string, variant: AppToastVariant = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastState({ message, variant });
    toastTimeoutRef.current = setTimeout(() => {
      setToastState(null);
      toastTimeoutRef.current = null;
    }, 5000);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastState(null);
  }, []);

  const confirm = useCallback((options: AppConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const finishConfirm = useCallback((value: boolean) => {
    confirmResolveRef.current?.(value);
    confirmResolveRef.current = null;
    setConfirmState(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <AppUiContext.Provider value={value}>
      {children}

      {toastState && (
        <Notification
          variant={toastState.variant === 'error' ? 'danger' : toastState.variant}
          message={toastState.message}
          onClose={dismissToast}
          position="top-right"
          zClassName="z-[100]"
        />
      )}

      <Modal
        isOpen={!!confirmState}
        onClose={() => finishConfirm(false)}
        title={confirmState?.title ?? 'Confirm'}
        size="sm"
        variant={confirmState?.variant === 'danger' ? 'danger' : 'default'}
        showCloseButton
        closeOnOverlayClick
        backdropClassName="modal-backdrop !z-[60]"
        footer={
          confirmState ? (
            <>
              <Button variant="outline" onClick={() => finishConfirm(false)}>
                {confirmState.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={confirmState.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => finishConfirm(true)}
              >
                {confirmState.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          ) : null
        }
      >
        {confirmState ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{confirmState.message}</p>
        ) : null}
      </Modal>
    </AppUiContext.Provider>
  );
}
