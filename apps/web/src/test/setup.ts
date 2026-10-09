import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

/**
 * Setup global de los tests de frontend.
 *
 * `onUnhandledRequest: 'error'` es deliberado: si un componente llama a un
 * endpoint que nadie declaro, el test FALLA en vez de quedarse colgado
 * esperando una respuesta que nunca llega. Los fallos silenciosos por
 * peticiones no mockeadas son de los mas caros de diagnosticar.
 */

// JSDOM no implementa completamente HTMLDialogElement.
// Simulamos showModal y close para las pruebas del frontend.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};

HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  // Descarta los handlers que un test agrego con server.use(...), para que no
  // se filtren al siguiente.
  server.resetHandlers();
  cleanup();
});

afterAll(() => server.close());
