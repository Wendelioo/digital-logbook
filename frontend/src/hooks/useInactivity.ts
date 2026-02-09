import { useEffect } from 'react';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

/**
 * Hook to handle user inactivity and automatic logout
 * @param onInactive - Callback function to execute when user becomes inactive
 * @param enabled - Whether inactivity detection is enabled
 */
export function useInactivityDetection(onInactive: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onInactive, INACTIVITY_TIMEOUT);
    };

    // Add event listeners for activity
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // Start timer
    resetTimer();

    // Cleanup
    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [onInactive, enabled]);
}

/**
 * Hook to handle cleanup on window unload (app close)
 * @param onUnload - Callback function to execute before unload
 * @param enabled - Whether unload handling is enabled
 */
export function useWindowUnload(onUnload: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      onUnload();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
    };
  }, [onUnload, enabled]);
}
