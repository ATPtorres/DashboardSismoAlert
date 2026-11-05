import test from 'node:test';
import assert from 'node:assert/strict';
import {Poller} from '../web/src/api/client.js';
test('Stopped/restarted poller cannot apply a late response from the previous mode',async()=>{
  const resolves=[],seen=[];const p=new Poller(()=>new Promise(r=>resolves.push(r)),r=>seen.push(r),()=>{}, {period:10000});
  p.start();p.stop();p.start();resolves[0]('old-real');resolves[1]('new-demo');await new Promise(r=>setTimeout(r,5));p.stop();assert.deepEqual(seen,['new-demo']);
});
