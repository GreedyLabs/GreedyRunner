import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * 백엔드 ESLint 설정.
 *
 * CLAUDE.md는 "ESLint 및 Prettier 규칙 준수"와 "any 사용 금지"를 표준으로 선언하는데,
 * 백엔드에는 린트 설정 자체가 없어 그 표준이 검사되지 않았다. 프론트엔드와 같은
 * flat config + typescript-eslint 조합을 쓴다.
 *
 * 확장자가 .mjs인 이유: 백엔드는 CommonJS로 컴파일되므로 package.json에
 * "type": "module"을 넣을 수 없고, .js로 두면 ESLint가 CommonJS로 파싱을 시도해
 * 경고를 낸다. 설정 파일만 ESM으로 못 박는다.
 */
export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // 표준이 금지하는 any를 경고가 아니라 오류로 올린다.
      '@typescript-eslint/no-explicit-any': 'error',
      // 쓰지 않는 변수는 `_` 접두사로만 허용한다 (구조 분해로 필드를 걷어낼 때 필요).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
