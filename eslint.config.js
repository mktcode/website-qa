import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'coverage',
    'node_modules',
  ],
  jsonc: false,
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  typescript: true,
  yaml: false,
  rules: {
    'antfu/no-top-level-await': 'off',
    'curly': ['error', 'all'],
    'no-console': ['error', {
      allow: ['error', 'group', 'groupEnd', 'info', 'trace', 'warn'],
    }],
    'node/prefer-global/process': ['error', 'always'],
    'style/comma-dangle': 'off',
  },
})
