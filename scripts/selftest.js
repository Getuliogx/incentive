import assert from 'node:assert/strict';
import { parseMetaCommand } from '../src/command.js';

const a = parseMetaCommand('300 | T1 | Pokémon');
assert.equal(a.amount, 300);
assert.equal(a.season, 1);
assert.equal(a.title, 'Pokémon');

const b = parseMetaCommand('80,50 | Naruto Shippuden | T3');
assert.equal(b.amount, 80.5);
assert.equal(b.season, 3);
assert.equal(b.title, 'Naruto Shippuden');

const c = parseMetaCommand('150 Frieren');
assert.equal(c.amount, 150);
assert.equal(c.season, null);
assert.equal(c.title, 'Frieren');

const d = parseMetaCommand('1.500,75 | T2 | One Piece');
assert.equal(d.amount, 1500.75);
assert.equal(d.season, 2);
assert.equal(d.title, 'One Piece');

console.log('SELFTEST OK');
