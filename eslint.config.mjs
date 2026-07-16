import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
);
