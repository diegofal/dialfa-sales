module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Permitir líneas más largas en el body (para Co-Authored-By y URLs)
    'body-max-line-length': [2, 'always', 150],
    // Permitir subject case más flexible
    'subject-case': [0],
    // Aumentar longitud máxima del subject
    'subject-max-length': [2, 'always', 100],
  },
};
