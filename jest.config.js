export default {
  collectCoverage: true,
  collectCoverageFrom: ['lib/*.js'],
  coverageDirectory: '<rootDir>/.coverage',
  verbose: true,
  transform: {},
  moduleNameMapper: {
    "#ansi-styles": "chalk/source/vendor/ansi-styles/index.js",
    "#supports-color": "chalk/source/vendor/supports-color/index.js"
  },
};
