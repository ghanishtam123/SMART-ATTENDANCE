import morgan from 'morgan';

export const requestLogger = morgan(
  ':method :url :status :response-time ms',
  {
    skip: (req) => req.url?.startsWith('/health') ?? false,
    stream: {
      write: (message: string) => {
        console.log(`INFO | ${message.trim()}`);
      },
    },
  },
);
