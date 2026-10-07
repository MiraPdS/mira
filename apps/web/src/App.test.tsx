import { describe, expect, it } from 'vitest';
import { renderConProviders, screen } from '@/test/render';
import { App } from './App';

/**
 * Mapeo de rutas de App.
 *
 * Las pruebas de cada pagina la renderizan directamente; aqui se verifica que
 * la URL lleve a esa pagina, para detectar una regresion en el arbol de rutas.
 */
describe('App', () => {
  it('en /registro muestra el formulario de registro', () => {
    renderConProviders(<App />, { route: '/registro' });

    expect(screen.getByRole('heading', { name: /crear cuenta/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contrasena/i)).toBeInTheDocument();
  });
});
