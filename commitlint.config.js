/**
 * Convencion de commits de Mira.
 *
 * Formato obligatorio:  <tipo>(<scope>): MIR-<n> <descripcion>
 * Ejemplo:              feat(work-items): MIR-12 crear historia de usuario
 *
 * El ID de Jira es obligatorio porque la rubrica evalua la cadena de
 * trazabilidad historia -> item de Jira -> rama -> commit -> PR -> pipeline.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'test', 'ci', 'docs', 'refactor', 'chore', 'perf', 'build', 'revert'],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    'jira-id-required': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'jira-id-required': ({ subject, type }) => {
          // Los commits de mantenimiento puro quedan exentos.
          if (type === 'chore' || type === 'revert') return [true];
          return [
            typeof subject === 'string' && /\bMIR-\d+\b/.test(subject),
            'el subject debe incluir el ID de Jira, por ejemplo: feat(api): MIR-12 crear proyecto',
          ];
        },
      },
    },
  ],
};
