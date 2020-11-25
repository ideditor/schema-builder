const fs = require('fs');
const shell = require('shelljs');

const schemaBuilder = require('../lib/index.js');

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
    let pathComponents = key.split('/');
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
  it('accesses modules without error', () => {
    expect(schemaBuilder && schemaBuilder.buildDist).not.toBeUndefined();
    expect(schemaBuilder && schemaBuilder.buildDev).not.toBeUndefined();
    expect(schemaBuilder && schemaBuilder.validate).not.toBeUndefined();
    expect(schemaBuilder && schemaBuilder.fetchTranslations).not.toBeUndefined();
  });

  it('runs validate', () => {
    writeSourceData({
      'data/presets/natural.json': {
        tags: {
          natural: '*'
        },
        geometry: ['point', 'vertex', 'line', 'area', 'relation'],
        name: 'Natural Feature'
      }
    });
    schemaBuilder.validate({
      inDirectory: _workspace + '/data'
    });
    expect(fs.existsSync(_workspace + '/interim')).toBe(false);
    expect(fs.existsSync(_workspace + '/dist')).toBe(false);
  });

  it('runs buildDev', () => {
    writeSourceData({
      'data/presets/natural.json': {
        tags: {
          natural: '*'
        },
        geometry: ['point', 'vertex', 'line', 'area', 'relation'],
        name: 'Natural Feature'
      }
    });
    schemaBuilder.buildDev({
      inDirectory: _workspace + '/data',
      interimDirectory: _workspace + '/interim'
    });
    expect(fs.existsSync(_workspace + '/interim/source_strings.yaml')).toBe(true);
    expect(fs.existsSync(_workspace + '/dist')).toBe(false);
  });

  it('runs buildDist', () => {
    writeSourceData({
      'data/presets/natural.json': {
        tags: {
          natural: '*'
        },
        geometry: ['point', 'vertex', 'line', 'area', 'relation'],
        name: 'Natural Feature'
      }
    });
    schemaBuilder.buildDist({
      inDirectory: _workspace + '/data',
      interimDirectory: _workspace + '/interim',
      outDirectory: _workspace + '/dist'
    });
    expect(fs.existsSync(_workspace + '/interim/source_strings.yaml')).toBe(true);
    expect(fs.existsSync(_workspace + '/dist')).toBe(true);
  });
});
