import assert from 'node:assert/strict';
import { extractGoalId } from '../src/id.js';

assert.equal(extractGoalId('MKIlwoZh2xHTuN'), 'MKIlwoZh2xHTuN');
assert.equal(extractGoalId('"MKIlwoZh2xHTuN"'), 'MKIlwoZh2xHTuN');
assert.equal(extractGoalId({ id: 'MKIlwoZh2xHTuN' }), 'MKIlwoZh2xHTuN');
assert.equal(extractGoalId({ data: { goalId: 'MKIlwoZh2xHTuN' } }), 'MKIlwoZh2xHTuN');
assert.equal(extractGoalId({ result: { interactionId: 'MKIlwoZh2xHTuN' } }), 'MKIlwoZh2xHTuN');
assert.equal(extractGoalId({}, { location: 'https://incentive.gg/panel/interactions/goals/manager/MKIlwoZh2xHTuN' }), 'MKIlwoZh2xHTuN');
console.log('IDTEST OK');
