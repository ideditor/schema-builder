const fs = require('fs');
const shell = require('shelljs');

const schemaBuilder = require('../lib/index.js');

const _workspace = 'tests/workspace';

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
    fs.writeFileSync(_workspace + '/' + key, JSON.stringify(data[key], null, 4));
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

  it('runs buildDist', (done) => {
    writeSourceData({
      'data/preset_categories/water.json': {
        icon: 'temaki-water',
        name: 'Water Features',
        members: [
          'natural/water',
          'natural/water/pond'
        ]
      },
      'data/fields/natural.json': {
        key: 'natural',
        type: 'typeCombo',
        label: 'Natural Type',
        placeholder: 'water, tree, wood…'
      },
      'data/fields/description.json': {
        key: 'description',
        type: 'textarea',
        label: 'Description',
        universal: true
      },
      'data/presets/_natural.json': {
        fields: [
          'natural'
        ],
        tags: {
          natural: '*'
        },
        geometry: ['point', 'vertex', 'line', 'area', 'relation'],
        searchable: false,
        name: 'Natural Feature'
      },
      'data/presets/natural/water.json': {
        tags: {
          natural: 'water'
        },
        geometry: ['point', 'area'],
        terms: ['pond', 'lake', 'pool', 'reservoir'],
        name: 'Water'
      },
      'data/presets/natural/water/pond.json': {
        tags: {
          natural: 'water',
          water: 'pond'
        },
        geometry: ['point', 'area'],
        terms: ['pool'],
        name: 'Pond'
      }
    });
    schemaBuilder.buildDist({
      inDirectory: _workspace + '/data',
      interimDirectory: _workspace + '/interim',
      outDirectory: _workspace + '/dist',
      taginfoProjectInfo: {
        name: 'IntrepiD',
        description: 'iD editor, but adventurous.',
        project_url: 'https://example.com/IntrepiD',
        contact_name: 'J. Maintainer',
        contact_email: 'maintainer@example.com'
      },
      listReusedIcons: true
    }).then(function() {
      expect(fs.existsSync(_workspace + '/interim/source_strings.yaml')).toBe(true);
      expect(fs.existsSync(_workspace + '/dist')).toBe(true);
      done();
    });
  });
});
