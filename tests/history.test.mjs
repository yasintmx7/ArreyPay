import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getTransfers,saveTransfer,getActions,saveAction} from '../web/history.js';

test('confirmed transfers survive reload, stay scoped to each wallet, and do not duplicate',()=>{
 const data=new Map();
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const alice='0x'+'a'.repeat(40),bob='0x'+'b'.repeat(40),merchant='0x'+'c'.repeat(40);
 const first={hash:'0x'+'1'.repeat(64),from:alice,to:merchant,amount:1000000n};
 const second={hash:'0x'+'2'.repeat(64),from:bob,to:merchant,amount:2500000n};
 const third={hash:'0x'+'3'.repeat(64),from:alice,to:merchant,amount:500000n};
 assert.equal(saveTransfer(first,storage,1000),true);
 assert.equal(saveTransfer(second,storage,2000),true);
 assert.equal(saveTransfer(third,storage,3000),true);
 assert.equal(saveTransfer(first,storage,4000),true);
 assert.deepEqual(getTransfers(alice,storage).map(x=>x.hash),[third.hash,first.hash]);
 assert.deepEqual(getTransfers(bob,storage).map(x=>x.hash),[second.hash]);
 assert.equal(getTransfers(alice,storage)[0].amount,'500000');
});

test('confirmed checkout actions remain ordered and isolated without duplicate transactions',()=>{
 const data=new Map();
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const alice='0x'+'a'.repeat(40),bob='0x'+'b'.repeat(40);
 const created={hash:'0x'+'4'.repeat(64),account:alice,type:'created',billId:'12',amount:3000000n,title:'Dinner'};
 const contributed={hash:'0x'+'5'.repeat(64),account:bob,type:'contributed',billId:'12',amount:1000000n,title:'Dinner'};
 const refunded={hash:'0x'+'6'.repeat(64),account:bob,type:'refunded',billId:'12',amount:1000000n,title:'Dinner'};
 assert.equal(saveAction(created,storage,1000),true);
 assert.equal(saveAction(contributed,storage,2000),true);
 assert.equal(saveAction(refunded,storage,3000),true);
 assert.equal(saveAction(contributed,storage,4000),true);
 assert.deepEqual(getActions(alice,storage).map(x=>x.type),['created']);
 assert.deepEqual(getActions(bob,storage).map(x=>x.type),['refunded','contributed']);
 assert.equal(getActions(bob,storage)[0].billId,'12');
});
