import { clearStorage, setStorage } from './domstub';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getCredentials, saveCredentials, clearCredentials, isSignedIn } from '../../src/auth';

beforeEach(() => clearStorage());

test('no stored credentials', () => {
  assert.equal(getCredentials(), null);
  assert.equal(isSignedIn(), false);
});

test('save then read credentials', () => {
  saveCredentials('bob', 'hunter2');
  assert.deepEqual(getCredentials(), { username: 'bob', password: 'hunter2' });
  assert.equal(isSignedIn(), true);
});

test('clear credentials', () => {
  saveCredentials('bob', 'hunter2');
  clearCredentials();
  assert.equal(getCredentials(), null);
  assert.equal(isSignedIn(), false);
});

test('corrupt stored credentials read as signed out', () => {
  setStorage('trove_credentials', 'not json');
  assert.equal(getCredentials(), null);
  assert.equal(isSignedIn(), false);
});
