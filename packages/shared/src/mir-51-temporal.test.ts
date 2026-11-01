import { describe, expect, it } from 'vitest';

describe('MIR-51 fallo provocado', () => {
  it('falla a proposito para probar el reporte JUnit', () => {
    expect(1).toBe(2);
  });
});
