import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import ganache from 'ganache';import {createPublicClient,createWalletClient,custom,defineChain} from 'viem';import {privateKeyToAccount} from 'viem/accounts';
import {parseAmount,formatAmount,equalShare} from '../web/amounts.js';
const artifact=JSON.parse(fs.readFileSync('artifacts/ArreyCheckout.json'));const mock=JSON.parse(fs.readFileSync('artifacts/MockUSDC.json'));const token='0x3600000000000000000000000000000000000000';
test('money parsing rejects rounding, scientific notation and invalid amounts',()=>{assert.equal(parseAmount('0.000001'),1n);assert.equal(parseAmount('20.25'),20250000n);for(const value of ['-1','0','1e3','1.0000001','NaN','1000001',''])assert.throws(()=>parseAmount(value));assert.equal(formatAmount(12345678n),'12.345678');assert.equal(equalShare(10n,3,0n,2n),2n);});
test('escrow lifecycle: exact settlement, races, authorization, refund isolation and rollback',async()=>{
 const provider=ganache.provider({logging:{quiet:true},chain:{chainId:5042002,hardfork:'shanghai'},wallet:{totalAccounts:4}});const chain=defineChain({id:5042002,name:'Local Arc-ID EVM',nativeCurrency:{name:'Test',symbol:'TEST',decimals:18},rpcUrls:{default:{http:[]}}});const p=createPublicClient({chain,transport:custom(provider),cacheTime:0});const accounts=await provider.request({method:'eth_accounts',params:[]});const wallets=accounts.map(address=>createWalletClient({account:privateKeyToAccount(provider.getInitialAccounts()[address].secretKey),chain,transport:custom(provider),cacheTime:0}));
 try{
 await provider.request({method:'evm_setAccountCode',params:[token,mock.deployedBytecode]});
 const mine=async hash=>{const r=await p.waitForTransactionReceipt({hash});assert.equal(r.status,'success');return r;};
 const dep=await mine(await wallets[0].deployContract({abi:artifact.abi,bytecode:artifact.bytecode}));const address=dep.contractAddress;
 const write=async(w,name,args,addr=address,abi=artifact.abi)=>{const {request}=await p.simulateContract({address:addr,abi,functionName:name,args,account:wallets[w].account});return mine(await wallets[w].writeContract(request));};
 const read=(name,args)=>p.readContract({address,abi:artifact.abi,functionName:name,args});
 const rejected=async(w,name,args)=>assert.rejects(()=>p.simulateContract({address,abi:artifact.abi,functionName:name,args,account:accounts[w]}));
 for(let i=0;i<4;i++){await write(0,'mint',[accounts[i],100000000n],token,mock.abi);await write(i,'approve',[address,100000000n],token,mock.abi);}
 let now=(await p.getBlock()).timestamp;
 await write(0,'create',['Shared dinner','Cafe',3000000n,now+3600n,3]);
 await write(1,'contribute',[1n,1000000n]);assert.equal((await read('getBill',[1n])).raised,1000000n);
 await rejected(2,'contribute',[1n,2000001n]);await rejected(2,'cancel',[1n]);await rejected(1,'claimRefund',[1n]);
 const merchantBefore=await p.readContract({address:token,abi:mock.abi,functionName:'balanceOf',args:[accounts[0]]});
 await write(2,'contribute',[1n,2000000n]);assert.equal((await read('getBill',[1n])).settled,true);
 assert.equal(await p.readContract({address:token,abi:mock.abi,functionName:'balanceOf',args:[accounts[0]]}),merchantBefore+3000000n);
 await rejected(3,'contribute',[1n,1n]);await rejected(1,'claimRefund',[1n]);await rejected(0,'cancel',[1n]);
 await write(0,'create',['Cancelled','Cafe',3000000n,now+3600n,3]);await write(1,'contribute',[2n,1000000n]);await write(0,'cancel',[2n]);await rejected(3,'claimRefund',[2n]);await write(1,'claimRefund',[2n]);assert.equal(await read('refunded',[2n,accounts[1]]),1000000n);await rejected(1,'claimRefund',[2n]);await rejected(2,'contribute',[2n,1n]);
 await write(0,'create',['Expiry','Cafe',1000000n,now+60n,2]);await write(1,'contribute',[3n,400000n]);await provider.request({method:'evm_increaseTime',params:[65]});await provider.request({method:'evm_mine',params:[]});await rejected(2,'contribute',[3n,600000n]);await write(1,'claimRefund',[3n]);
 now=(await p.getBlock()).timestamp;await write(0,'create',['Restricted recipient','Cafe',1000000n,now+3600n,2]);await write(1,'contribute',[4n,400000n]);await write(0,'blockAddress',[accounts[0]],token,mock.abi);await rejected(2,'contribute',[4n,600000n]);assert.equal((await read('getBill',[4n])).raised,400000n);assert.equal(await read('contribution',[4n,accounts[2]]),0n);await write(0,'cancel',[4n]);await write(1,'claimRefund',[4n]);
 const [ids,total]=await read('getWalletBills',[accounts[1],0n,100n]);assert.equal(total,4n);assert.deepEqual(ids,[4n,3n,2n,1n]);
 await rejected(0,'create',['','Cafe',1n,now+100n,2]);await rejected(0,'create',['Bad','Cafe',1n,now+100n,0]);
 const code=await p.getCode({address});assert.equal(code,artifact.deployedBytecode);
 }finally{await provider.disconnect();}
});
