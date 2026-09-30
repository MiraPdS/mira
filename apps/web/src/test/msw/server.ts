import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Servidor de MSW compartido por toda la suite. Se arranca en test/setup.ts. */
export const server = setupServer(...handlers);
