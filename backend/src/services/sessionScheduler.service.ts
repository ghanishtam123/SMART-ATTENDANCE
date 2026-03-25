import logger from '../config/logger';
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
      logger.info(
        {
          checkedCount: result.checkedCount,
          completedCount: result.completedCount,
          completedSessionIds: result.completedSessionIds,
        },
        'Automatically completed overdue sessions.',
      );
    }
  } catch (error) {
    logger.error(
      { err: error },
      'Failed while checking for overdue sessions to auto-complete.',
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

    logger.info(
      {
        intervalMs: SESSION_AUTO_COMPLETE_INTERVAL_MS,
      },
      'Session auto-complete scheduler started.',
    );

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
