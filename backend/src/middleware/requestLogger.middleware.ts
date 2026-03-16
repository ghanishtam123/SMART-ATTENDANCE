import morgan from 'morgan';

import env from '../config/env';
import logger from '../config/logger';

export const requestLogger = morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev',
  {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  },
);
