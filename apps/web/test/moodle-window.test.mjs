// IINICIA Portal · pruebas de integración · moodle-window.test.mjs
/** Comprueba la función que usa el navegador antes de abrir el campus con enlaces locales de prueba, sin depender del Moodle de producción. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMoodleLaunchUrl } from '../src/lib/moodle-window.ts';

const campus = 'https://campus.example/moodle';
const login = campus + '/auth/userkey/login.php';
/** Compone un enlace de ensayo con una clave temporal y el destino que evaluará la validación. */
const destination = (value) => login + '?key=test&' + new URLSearchParams({ wantsurl: value });

test('retains valid SSO links to campus, course and gradebook', () => {
  for (const path of ['/', '/course/view.php?id=2', '/grade/report/grader/index.php?id=2']) {
    const target = destination(campus + path);
    assert.equal(validateMoodleLaunchUrl(target, campus), target);
  }
});

test('rejects SSO redirects outside the configured campus', () => {
  assert.throws(() => validateMoodleLaunchUrl(destination('https://otro.example/'), campus));
  assert.throws(() => validateMoodleLaunchUrl(destination(campus + '-otro/'), campus));
  assert.throws(() => validateMoodleLaunchUrl(destination(campus + '/otro.php'), campus));
});

test('requires a single SSO key and an unambiguous destination', () => {
  assert.throws(() => validateMoodleLaunchUrl(login, campus));
  assert.throws(() => validateMoodleLaunchUrl(login + '?key=test&key=otro', campus));
  const target = destination(campus + '/') + '&' + new URLSearchParams({ wantsurl: campus + '/' });
  assert.throws(() => validateMoodleLaunchUrl(target, campus));
});
