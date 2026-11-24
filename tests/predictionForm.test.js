const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() {
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.readOnly = false;
    this.children = [];
    this.handlers = {};
    this.classList = { toggle() {}, remove() {}, add() {} };
    this.style = {};
  }

  addEventListener(event, handler) { this.handlers[event] = handler; }
  async dispatch(event) { await this.handlers[event]?.({ preventDefault() {}, key: '' }); }
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  add(child) { this.children.push(child); }
  focus() {}
  reportValidity() { return true; }
}

test('optional patient search fills fields and clearing selection returns to manual input', async () => {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  global.document = {
    getElementById: getElement,
    createElement: () => new Element(),
  };
  global.Option = class {
    constructor(text, value) { this.text = text; this.value = value; }
  };

  let submittedPayload;
  let predictionError = false;
  global.fetch = async (url, options) => {
    let data;
    if (url.startsWith('/api/tratamientos')) {
      data = { treatments: [{ id: 1, nombre: 'Limpieza' }] };
    } else if (url.startsWith('/api/reportes/prediccion/pacientes/')) {
      data = { features: {
        age: 42, sex: 'F', previousAppointments: 3, previousAbsences: 1,
        previousAttendances: 2, daysSincePrevious: 20, hasPreviousAppointments: true,
      } };
    } else if (url.startsWith('/api/reportes/prediccion/pacientes?')) {
      data = { patients: [{ id: 123, nombre_completo: 'Paciente de prueba' }] };
    } else if (url === '/api/reportes/prediccion') {
      submittedPayload = JSON.parse(options.body);
      if (predictionError) {
        return { ok: false, json: async () => ({ message: 'No se pudo calcular.' }) };
      }
      data = { prediction: 'ATENDIDA', probabilityOfAttendance: 0.8, probabilityOfAbsence: 0.2 };
    } else {
      throw new Error(`Unexpected request: ${url}`);
    }
    return { ok: true, json: async () => data };
  };

  const source = await fs.readFile(path.join(__dirname, '../public/js/modules/prediction.js'), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const { setupPredictionHandlers } = await import(moduleUrl);
  await setupPredictionHandlers();

  const search = getElement('prediction-patient-search');
  search.value = 'Paciente';
  await search.dispatch('input');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const results = getElement('prediction-patient-results');
  assert.equal(results.children.length, 1);
  await results.children[0].dispatch('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getElement('prediction-age').value, 42);
  assert.equal(getElement('prediction-sex').value, 'F');
  assert.equal(getElement('prediction-previous-appointments').value, '3');

  search.value = 'Otro';
  await search.dispatch('input');
  assert.equal(getElement('prediction-age').value, '');
  assert.equal(getElement('prediction-selected-patient').textContent, '');
  await new Promise((resolve) => setTimeout(resolve, 300));
  await results.children[0].dispatch('click');
  await new Promise((resolve) => setImmediate(resolve));

  await getElement('prediction-clear-patient').dispatch('click');
  assert.equal(getElement('prediction-age').value, '');
  assert.equal(getElement('prediction-sex').value, '');
  assert.equal(getElement('prediction-previous-appointments').value, '0');
  assert.equal(getElement('prediction-previous-appointments').readOnly, false);
  assert.equal(getElement('prediction-submit').disabled, false);

  getElement('prediction-age').value = '30';
  getElement('prediction-sex').value = 'M';
  getElement('prediction-treatment').value = '1';
  getElement('prediction-time').value = '09:30';
  getElement('prediction-cost').value = '0';
  await getElement('prediction-form').dispatch('submit');
  assert.equal(submittedPayload.patientId, undefined);
  assert.equal(submittedPayload.age, 30);
  assert.equal(getElement('prediction-form-status').textContent, '');
  assert.equal(getElement('prediction-result').hidden, false);

  predictionError = true;
  await getElement('prediction-form').dispatch('submit');
  assert.equal(getElement('prediction-form-status').textContent, 'No se pudo calcular.');
});

test('sidebar prediction navigation preserves the form and returns to reports', async () => {
  class NavigationElement extends Element {
    constructor() {
      super();
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name)
      };
    }
    setAttribute(name) { if (name === 'hidden') this.hidden = true; }
    removeAttribute(name) { if (name === 'hidden') this.hidden = false; }
  }

  const dom = {};
  for (const name of ['Agenda', 'Patients', 'Settings', 'Reports', 'Inventario', 'Tratamientos']) {
    dom[`navLink${name}`] = new NavigationElement();
    dom[`tab${name}Content`] = new NavigationElement();
  }
  const predictionNav = new NavigationElement();
  const predictionPanel = new NavigationElement();
  const mainContent = { scrollTop: 0, scrollTo() {} };
  const document = {
    body: { classList: { contains: () => false } },
    getElementById: (id) => ({
      'nav-link-prediction': predictionNav,
      'tab-prediction-content': predictionPanel
    })[id],
    querySelector: () => mainContent,
    addEventListener: (event, handler) => { if (event === 'DOMContentLoaded') handler(); }
  };
  let reportLoads = 0;
  const noop = () => {};
  const context = {
    document, dom, window: {}, loadAppointments: noop, verifySession: noop,
    setupStatusModalHandlers: noop, setupPatientHandlers: noop, setupFichaHandlers: noop,
    setupSettingsHandlers: noop, setupReportsHandlers: noop, initInventarioHandlers: noop,
    loadFinancialReports: () => { reportLoads++; }, loadPatients: noop, loadSettings: noop,
    setupTreatmentsHandlers: noop, loadAndRenderTreatments: noop, loadInventario: noop
  };
  const source = (await fs.readFile(path.join(__dirname, '../public/js/dashboard.js'), 'utf8'))
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '');
  vm.runInNewContext(source, context);

  predictionPanel.value = 'datos conservados';
  for (const name of ['Agenda', 'Patients', 'Settings', 'Reports', 'Inventario', 'Tratamientos']) {
    await predictionNav.dispatch('click');
    assert.equal(predictionPanel.hidden, false);
    assert.equal(predictionNav.classList.contains('active'), true);
    await dom[`navLink${name}`].dispatch('click');
    assert.equal(predictionPanel.hidden, true);
    assert.equal(predictionNav.classList.contains('active'), false);
    assert.equal(dom[`tab${name}Content`].hidden, false);
  }
  await predictionNav.dispatch('click');
  assert.equal(predictionPanel.value, 'datos conservados');
  assert.equal(reportLoads, 1);
});
