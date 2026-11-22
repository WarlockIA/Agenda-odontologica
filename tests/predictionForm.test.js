const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

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
});
