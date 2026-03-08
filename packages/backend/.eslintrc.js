module.exports = {
  extends: ['../../.eslintrc.js'],
  env: {
    node: true,
    jest: true,
  },
  rules: {
    // Backend-specific rules
    'no-console': 'off', // Allow console.log in backend for logging
  },
};