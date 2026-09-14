import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createPublicClient,createWalletClient,defineChain,http,erc20Abi,formatEther,decodeEventLog} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
const chain=defineChain({id:5042002,name:'Arc Testnet',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:{default:{http:['https://rpc.testnet.arc.io']}}});
const transport=http(chain.rpcUrls.default.http[0],{timeout:20000});
const client=createPublicClient({chain,transport,cacheTime:0});
const secret=JSON.parse(fs.readFileSync('.test-wallet.json','utf8'));
const account=privateKeyToAccount(secret.privateKey);
const wallet=createWalletClient({account,chain,transport});
const token='0x3600000000000000000000000000000000000000';
const artifact=JSON.parse(fs.readFileSync('artifacts/ArreyCheckout.json','utf8'));
assert.equal(await client.getChainId(),5042002);
assert.equal(await client.readContract({address:token,abi:erc20Abi,functionName:'decimals'}),6);
const balance=await client.getBalance({address:account.address});
console.log(JSON.stringify({network:chain.name,address:account.address,balanceUSDC:formatEther(balance)}));
if(process.argv.includes('--status'))process.exit(0);
if(balance<1000000000000000000n)throw Error('Fund this isolated test wallet from Circle Faucet with at least 1 test USDC first.');
const file='public/deployment.json';
let record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
async function receipt(hash){const r=await client.waitForTransactionReceipt({hash,timeout:180000});assert.equal(r.status,'success');return r;}
if(!record){
 const gas=await client.estimateGas({account,data:artifact.bytecode});
 const price=await client.getGasPrice();
 if(gas*price>5000000000000000000n)throw Error('Estimated deployment fee exceeds 5 test USDC; stopped before signing.');
 const r=await receipt(await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode}));
 record={chainId:5042002,contract:r.contractAddress,deploymentTransaction:r.transactionHash,block:String(r.blockNumber),smokeTests:[]};
 fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');
}
assert.equal((await client.getCode({address:record.contract})).toLowerCase(),artifact.deployedBytecode.toLowerCase());
async function write(address,abi,functionName,args){const {request}=await client.simulateContract({address,abi,functionName,args,account});return receipt(await wallet.writeContract(request));}
async function create(title,target){const block=await client.getBlock();const r=await write(record.contract,artifact.abi,'create',[title,'Arrey integration test',target,block.timestamp+3600n,2]);for(const log of r.logs){try{const e=decodeEventLog({abi:artifact.abi,data:log.data,topics:log.topics});if(e.eventName==='Created')return e.args.id;}catch{}}throw Error('Missing checkout event');}
async function note(name,r,id){record.smokeTests.push({name,checkoutId:id?String(id):null,transaction:r.transactionHash});fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');}
if(!record.smokeTests.some(x=>x.name==='Exact settlement')){
 const id=await create('Arc live settlement test',30000n);
 await write(token,erc20Abi,'approve',[record.contract,30000n]);
 await write(record.contract,artifact.abi,'contribute',[id,10000n]);
 const r=await write(record.contract,artifact.abi,'contribute',[id,20000n]);
 const b=await client.readContract({address:record.contract,abi:artifact.abi,functionName:'getBill',args:[id]});
 assert.equal(b.settled,true);assert.equal(b.raised,30000n);await note('Exact settlement',r,id);
}
if(!record.smokeTests.some(x=>x.name==='Cancelled contribution refunded')){
 const id=await create('Arc live refund test',20000n);
 await write(token,erc20Abi,'approve',[record.contract,10000n]);
 await write(record.contract,artifact.abi,'contribute',[id,10000n]);
 await write(record.contract,artifact.abi,'cancel',[id]);
 const r=await write(record.contract,artifact.abi,'claimRefund',[id]);
 assert.equal(await client.readContract({address:record.contract,abi:artifact.abi,functionName:'refunded',args:[id,account.address]}),10000n);
 await note('Cancelled contribution refunded',r,id);
}
if(!record.smokeTests.some(x=>x.name==='Direct USDC transfer')){
 const r=await write(token,erc20Abi,'transfer',[account.address,1000n]);await note('Direct USDC transfer',r);
}
fs.writeFileSync('web/deployment.js',`// Verified Arc Testnet deployment. Public address only.\nexport const deployedContract = '${record.contract}';\n`);
console.log(JSON.stringify(record,null,2));
