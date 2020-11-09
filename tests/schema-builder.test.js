const fs = require('fs');
const shell = require('shelljs');

const schemaBuilder = require('../lib/schema-builder.js');

const _workspace = './tests/workspace';

beforeAll(() => {
  if (!fs.existsSync(_workspace)) {
    fs.mkdirSync(_workspace);
  }
});

afterAll(() => {
  shell.rm('-rf', [
    _workspace
  ]);
});

beforeEach(() => {
  shell.rm('-rf', [
    _workspace + '/*'
  ]);
});

function writeSourceData(data) {
  for (let key in data) {
    let path = '';
    let pathComponents = key.split('/')
    pathComponents.pop();
    while (pathComponents.length) {
      path += '/' + pathComponents.shift();
      if (!fs.existsSync(_workspace + path)) {
        fs.mkdirSync(_workspace + path);
      }
    }
    fs.writeFileSync(_workspace + '/' + key, JSON.stringify(data[key]));
  }
}


describe('schema-builder', () => {
  it('accesses module without error', () => {
    expect(schemaBuilder && schemaBuilder.build).not.toBeUndefined();
  });

  it('compiles data', () => {
    writeSourceData({
      'data/presets/natural.json': {
        tags: {
          natural: '*'
        },
        geometry: ['point', 'vertex', 'line', 'area', 'relation'],
        name: 'Natural Feature'
      }
    });
    schemaBuilder.build({
      inDirectory: _workspace + '/data',
      outDirectory: _workspace + '/dist'
    });
  });
});
