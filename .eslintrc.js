module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    node: true
  },
  extends: 'standard',
  // required to lint *.vue files
  plugins: [
  ],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module'
  },
  "settings": {
    "import/resolver": "webpack"
  },
  // add your custom rules here
  rules: {
    // allow paren-less arrow functions
    'arrow-parens': 0,
    // allow async-await
    'generator-star-spacing': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,

    'semi': 'off',
    'indent': 'off',
    'valid-typeof': 'off',
    'no-useless-escape': 'off',
    'no-unneeded-ternary': 'off',
    'space-before-function-paren': 'off',
    'no-extend-native': 'off'
  },
  globals: {}
};
