import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function declaration(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return app.slice(start, app.indexOf("\n}", start) + 2);
}

function birthTimeForm(precision = "exact") {
  const inputs = Object.fromEntries(["timePrecision", "timeValue", "timeStart", "timeEnd"].map(name => [name, { value: "", required: false }]));
  inputs.timePrecision.value = precision;
  const form = { elements: { namedItem: name => inputs[name] } };
  const wrappers = { timeWrap: {}, timeText: {}, marginWrap: {}, marginHint: {}, intervalWrap: {} };
  const context = vm.createContext({ form, precisionSelect: inputs.timePrecision, ...wrappers });
  vm.runInContext(declaration("field") + "\n" + declaration("syncPublicBirthTimeRequirements"), context);
  const start = app.indexOf("  const syncTimeVisibility = () => {");
  const end = app.indexOf("\n  precisionSelect.addEventListener", start);
  vm.runInContext(app.slice(start, end) + "\nglobalThis.sync = syncTimeVisibility", context);
  const valid = () => Object.values(inputs).every(input => !input.required || input.value !== "");
  const sync = () => context.sync();
  sync();
  return { inputs, wrappers, sync, valid };
}

test("the initial precise-time field is required even before the script initializes", () => {
  const expressForm = html.slice(html.indexOf('<form id="express-form"'), html.indexOf('</form>', html.indexOf('<form id="express-form"')));
  const field = expressForm.match(/<input name="timeValue"[^>]*>/)?.[0];
  assert.ok(field);
  assert.match(field, /\brequired\b/);
});

for (const precision of ["exact", "approximate"]) {
  test(`${precision} rejects an empty hour and accepts midnight`, () => {
    const form = birthTimeForm(precision);
    assert.equal(form.inputs.timeValue.required, true);
    assert.equal(form.inputs.timeStart.required, false);
    assert.equal(form.inputs.timeEnd.required, false);
    assert.equal(form.wrappers.timeWrap.hidden, false);
    assert.equal(form.valid(), false);
    form.inputs.timeValue.value = "00:00";
    assert.equal(form.valid(), true);
  });
}

test("an interval requires both visible endpoints without requiring a single hour", () => {
  const form = birthTimeForm("interval");
  assert.equal(form.inputs.timeValue.required, false);
  assert.equal(form.inputs.timeStart.required, true);
  assert.equal(form.inputs.timeEnd.required, true);
  assert.equal(form.wrappers.intervalWrap.hidden, false);
  assert.equal(form.valid(), false);
  form.inputs.timeStart.value = "05:00";
  assert.equal(form.valid(), false);
  form.inputs.timeEnd.value = "06:00";
  assert.equal(form.valid(), true);
});

test("an unknown hour removes hidden requirements without inventing a time", () => {
  const form = birthTimeForm();
  form.inputs.timePrecision.value = "interval";form.sync();
  assert.equal(form.valid(), false);
  form.inputs.timePrecision.value = "unknown";form.sync();
  assert.equal(form.valid(), true);
  assert.equal(form.wrappers.timeWrap.hidden, true);
  assert.equal(form.wrappers.intervalWrap.hidden, true);
  for (const name of ["timeValue", "timeStart", "timeEnd"]) {
    assert.equal(form.inputs[name].required, false);
    assert.equal(form.inputs[name].value, "");
  }
  form.inputs.timePrecision.value = "exact";form.sync();
  assert.equal(form.valid(), false);
});
