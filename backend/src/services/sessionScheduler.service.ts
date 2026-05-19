import { sessionService } from './session.service';

const SESSION_AUTO_COMPLETE_INTERVAL_MS = 60_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const runOverdueSessionCheck = async (): Promise<void> => {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await sessionService.autoCompleteOverdueSessions({
      trigger: 'scheduler',
    });

    if (result.completedCount > 0) {
      console.log('INFO | Automatically completed overdue sessions.', {
        checkedCount: result.checkedCount,
        completedCount: result.completedCount,
        completedSessionIds: result.completedSessionIds,
      });
    }
  } catch (error) {
    console.error(
      'ERROR | Failed while checking for overdue sessions to auto-complete.',
      { err: error },
    );
  } finally {
    isRunning = false;
  }
};

export const sessionSchedulerService = {
  start: (): void => {
    if (intervalHandle) {
      return;
    }

    intervalHandle = setInterval(() => {
      void runOverdueSessionCheck();
    }, SESSION_AUTO_COMPLETE_INTERVAL_MS);

    intervalHandle.unref?.();

    console.log('INFO | Session auto-complete scheduler started.', {
      intervalMs: SESSION_AUTO_COMPLETE_INTERVAL_MS,
    });

    void runOverdueSessionCheck();
  },

  stop: (): void => {
    if (!intervalHandle) {
      return;
    }

    clearInterval(intervalHandle);
    intervalHandle = null;
    isRunning = false;
  },
};
