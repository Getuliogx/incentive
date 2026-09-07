import assert from 'node:assert/strict';
import { parseMetaCommand } from '../src/command.js';
import { parseCurl } from '../src/curlRecipe.js';

assert.deepEqual(parseMetaCommand('150 | 2 | One Piece'), { amount:150, amountCents:15000, season:2, title:'One Piece' });
assert.deepEqual(parseMetaCommand('80,50 | T3 | Naruto Shippuden'), { amount:80.5, amountCents:8050, season:3, title:'Naruto Shippuden' });
assert.deepEqual(parseMetaCommand('50 | Frieren'), { amount:50, amountCents:5000, season:null, title:'Frieren' });
const c = parseCurl("curl 'https://example.com/api' -X POST -H 'content-type: application/json' --data-raw '{\"title\":\"{{TITLE}}\"}'");
assert.equal(c.url, 'https://example.com/api');
assert.equal(c.method, 'POST');
assert.equal(c.headers['content-type'], 'application/json');
assert.ok(c.body.includes('{{TITLE}}'));
console.log('selftest OK');
