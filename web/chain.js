import {createPublicClient,createWalletClient,custom,http,fallback,defineChain,erc20Abi,getAddress,isAddress,formatUnits} from 'viem';
import {ARC_ID,ARC_RPC,EXPLORER,USDC,DEFAULT_CONTRACT,WC_PROJECT_ID} from './config.js';
import {requiredBalance} from './amounts.js';
import artifact from './generated/contract.json';
export const arc=defineChain({id:ARC_ID,name:'Arc Testnet',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:{default:{http:[ARC_RPC]}},blockExplorers:{default:{name:'ArcScan',url:EXPLORER}},testnet:true});
export const publicClient=createPublicClient({chain:arc,transport:fallback([http(ARC_RPC,{timeout:12000,retryCount:1}),http('https://rpc.drpc.testnet.arc.io',{timeout:12000,retryCount:1})])});
export const state={account:null,provider:null,walletName:'',balance:null,chainId:null,registry:'',verified:false,network:false,busy:false,step:'',hash:null,error:null,bills:[],total:0,loaded:false};
export const providers=new Map();const listeners=new Set();export const subscribe=fn=>(listeners.add(fn),()=>listeners.delete(fn));export function emit(){listeners.forEach(fn=>fn(state));}
window.addEventListener('eip6963:announceProvider',e=>{const d=e.detail;if(d?.info?.uuid&&typeof d.provider?.request==='function'){providers.set(d.info.uuid,d);emit();}});window.dispatchEvent(new Event('eip6963:requestProvider'));
export function getProviders(){if(!providers.size&&window.ethereum)providers.set('injected',{info:{uuid:'injected',name:'Browser wallet'},provider:window.ethereum});return [...providers.values()];}
let accountHandler,chainHandler,disconnectHandler;
export async function connect(id){
 let provider,name;
 if(id==='walletconnect'){
  if(!WC_PROJECT_ID)throw Error('WalletConnect project ID is not configured. Open this site in your mobile wallet browser instead.');
  const {EthereumProvider}=await import('@walletconnect/ethereum-provider');
  provider=await EthereumProvider.init({projectId:WC_PROJECT_ID,optionalChains:[ARC_ID,11155111,84532],showQrModal:true,rpcMap:{[ARC_ID]:ARC_RPC,11155111:'https://ethereum-sepolia-rpc.publicnode.com',84532:'https://sepolia.base.org'},metadata:{name:'Arrey',description:'Pay solo or together on Arc Testnet',url:location.origin,icons:[location.origin+'/logo.jpg']}});
  await provider.connect();name='WalletConnect';
 }else{const d=getProviders().find(p=>p.info.uuid===id);if(!d)throw Error('Wallet not found. Unlock it and try again.');provider=d.provider;name=d.info.name;}
 const accounts=await provider.request({method:'eth_requestAccounts'});if(!accounts?.[0]||!isAddress(accounts[0]))throw Error('No wallet account selected.');
 detach();state.provider=provider;state.account=getAddress(accounts[0]);state.walletName=name;
 accountHandler=accounts=>{state.account=accounts[0]?getAddress(accounts[0]):null;state.balance=null;state.bills=[];emit();refreshWallet().catch(()=>{});};
 chainHandler=id=>{state.chainId=Number(id);emit();};disconnectHandler=()=>disconnect();
 provider.on?.('accountsChanged',accountHandler);provider.on?.('chainChanged',chainHandler);provider.on?.('disconnect',disconnectHandler);
 state.chainId=Number(await provider.request({method:'eth_chainId'}));await refreshWallet();emit();localStorage.setItem('arrey-wallet-id', id);
}
function detach(){if(state.provider){state.provider.removeListener?.('accountsChanged',accountHandler);state.provider.removeListener?.('chainChanged',chainHandler);state.provider.removeListener?.('disconnect',disconnectHandler);}}
export function disconnect(){detach();state.account=null;state.provider=null;state.chainId=null;state.balance=null;state.bills=[];emit();localStorage.removeItem('arrey-wallet-id');}
export async function refreshWallet(){const account=state.account;if(!account)return;const balance=await publicClient.readContract({address:USDC,abi:erc20Abi,functionName:'balanceOf',args:[account]});if(state.account===account){state.balance=balance;emit();}}
export async function ensureArc(){
 if(!state.provider||!state.account)throw Error('Connect your wallet first.');
 let id=Number(await state.provider.request({method:'eth_chainId'}));
 if(id!==ARC_ID){try{await state.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+ARC_ID.toString(16)}]});}catch(e){if(e.code!==4902&&e.cause?.code!==4902&&!(e.message&&/unrecognized chain/i.test(e.message)))throw e;await state.provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0x'+ARC_ID.toString(16),chainName:arc.name,nativeCurrency:arc.nativeCurrency,rpcUrls:[ARC_RPC],blockExplorerUrls:[EXPLORER]}]});}}
 id=Number(await state.provider.request({method:'eth_chainId'}));if(id!==ARC_ID)throw Error('Switch to Arc Testnet in your wallet. Mainnet payments are disabled.');
 const accounts=await state.provider.request({method:'eth_accounts'});if(!accounts[0]||getAddress(accounts[0])!==state.account)throw Error('Wallet account changed. Reconnect before continuing.');state.chainId=id;
 return createWalletClient({account:state.account,chain:arc,transport:custom(state.provider)});
}
export async function addArcNetwork(){
 if(!state.provider)throw Error('Connect your wallet first.');
 const params={chainId:'0x'+ARC_ID.toString(16),chainName:arc.name,nativeCurrency:arc.nativeCurrency,rpcUrls:[ARC_RPC,'https://rpc.drpc.testnet.arc.io'],blockExplorerUrls:[EXPLORER]};
 try{await state.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:params.chainId}]});}
 catch(e){if(e.code!==4902&&e.cause?.code!==4902&&!(e.message&&/unrecognized chain/i.test(e.message)))throw e;await state.provider.request({method:'wallet_addEthereumChain',params:[params]});}
 state.chainId=Number(await state.provider.request({method:'eth_chainId'}));emit();return state.chainId===ARC_ID;
}
export async function checkNetwork(){const [chainId,decimals]=await Promise.all([publicClient.getChainId(),publicClient.readContract({address:USDC,abi:erc20Abi,functionName:'decimals'})]);if(chainId!==ARC_ID||Number(decimals)!==6)throw Error('Arc network or USDC configuration mismatch. Payments are disabled.');state.network=true;emit();return true;}
export async function setRegistry(value){if(!isAddress(value))throw Error('Enter a valid Arc contract address.');const addr=getAddress(value);state.verified=false;const code=await publicClient.getCode({address:addr});if(code?.toLowerCase()!==artifact.deployedBytecode.toLowerCase())throw Error('This address does not match the compiled Arrey checkout contract. No approval will be requested.');state.registry=addr;state.verified=true;const url=new URL(location.href);url.searchParams.set('registry',addr);history.replaceState(null,'',url);emit();return addr;}
export async function initRegistry(){const value=new URL(location.href).searchParams.get('registry')||DEFAULT_CONTRACT;if(value)await setRegistry(value);}
export function requireRegistry(){if(!state.verified||!state.registry)throw Error('Set up and verify the Arc checkout contract first.');}
async function wait(hash,label){state.hash=hash;state.step=label;emit();let replaced=false;const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:1,timeout:180000,onReplaced:r=>{state.hash=r.transaction.hash;replaced=r.reason!=='repriced';emit();}});if(replaced)throw Error('Transaction cancelled or changed in your wallet. Refresh the bill before trying again.');if(receipt.status!=='success')throw Error('The transaction reverted. No payment was recorded.');return receipt;}
export async function task(fn){if(state.busy)throw Error('A wallet operation is already in progress.');state.busy=true;state.error=null;state.hash=null;state.step='Preparing wallet…';emit();try{return await fn();}catch(e){state.error=e.shortMessage||e.message||'Operation failed';throw e;}finally{state.busy=false;state.step='';await refreshWallet().catch(()=>{});emit();}}
async function write(functionName,args){requireRegistry();const wallet=await ensureArc();const {request}=await publicClient.simulateContract({address:state.registry,abi:artifact.abi,functionName,args,account:state.account});state.step='Confirm in your wallet';emit();const hash=await wallet.writeContract(request);return wait(hash,'Waiting for Arc confirmation…');}
export async function deployRegistry(){return task(async()=>{const wallet=await ensureArc();await checkNetwork();state.step='Confirm checkout contract deployment';emit();const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode});const receipt=await wait(hash,'Deploying on Arc Testnet…');if(!receipt.contractAddress)throw Error('Deployment returned no contract address.');await setRegistry(receipt.contractAddress);return receipt.contractAddress;});}
export async function createBill({title,merchantName,target,deadline,people}){return task(async()=>{const receipt=await write('create',[title,merchantName,target,BigInt(deadline),people]);const {decodeEventLog}=await import('viem');for(const log of receipt.logs){try{if(log.address.toLowerCase()!==state.registry.toLowerCase())continue;const e=decodeEventLog({abi:artifact.abi,data:log.data,topics:log.topics});if(e.eventName==='Created')return e.args.id.toString();}catch{}}throw Error('Transaction confirmed, but could not read its checkout ID. Refresh your merchant dashboard; do not create again.');});}
export async function loadBill(id){requireRegistry();if(!/^\d+$/.test(String(id)))throw Error('Invalid checkout ID.');const raw=await publicClient.readContract({address:state.registry,abi:artifact.abi,functionName:'getBill',args:[BigInt(id)]});const [accounts,amounts,refunds,total]=await publicClient.readContract({address:state.registry,abi:artifact.abi,functionName:'getContributors',args:[BigInt(id),0n,100n]});const block=await publicClient.getBlock();return {...raw,id:String(id),remaining:raw.target-raw.raised,expired:block.timestamp>=raw.deadline,status:raw.settled?'paid':raw.cancelled?'cancelled':block.timestamp>=raw.deadline?'expired':'active',contributors:accounts.map((address,i)=>({address,amount:amounts[i],refund:refunds[i]})),contributorCount:Number(total)};}
export async function loadBills(){requireRegistry();const account=state.account,registry=state.registry;if(!account){state.bills=[];state.loaded=true;emit();return [];}const [ids,total]=await publicClient.readContract({address:registry,abi:artifact.abi,functionName:'getWalletBills',args:[account,0n,50n]});const results=[];for(let i=0;i<ids.length;i+=5){if(state.account!==account||state.registry!==registry)return [];results.push(...await Promise.all(ids.slice(i,i+5).map(id=>loadBill(id))));}if(state.account!==account||state.registry!==registry)return [];state.bills=results;state.total=Number(total);state.loaded=true;emit();return results;}
export async function estimatePayment(id,amount){requireRegistry();const bill=await loadBill(id);if(bill.status!=='active'||amount<=0n||amount>bill.remaining)throw Error('The checkout changed. Refresh and check the remaining amount.');if(!state.account)throw Error('Connect your wallet first.');const [price,allowance]=await Promise.all([publicClient.getGasPrice(),publicClient.readContract({address:USDC,abi:erc20Abi,functionName:'allowance',args:[state.account,state.registry]})]);let gas;if(allowance>=amount){gas=await publicClient.estimateContractGas({address:state.registry,abi:artifact.abi,functionName:'contribute',args:[BigInt(id),amount],account:state.account});}else gas=450000n;const gasWei=gas*price;return {gasUSDC:formatUnits(gasWei,18),gasWei,required:requiredBalance(amount,gasWei),approval:allowance<amount,estimated:allowance<amount};}
export async function contribute(id,amount){return task(async()=>{requireRegistry();let wallet=await ensureArc();let b=await loadBill(id);if(b.status!=='active'||amount<=0n||amount>b.remaining)throw Error('Amount exceeds the remaining balance or checkout is closed.');await refreshWallet();const estimate=await estimatePayment(id,amount);if(state.balance<estimate.required)throw Error('Insufficient USDC for this payment plus a network-fee safety buffer. Reduce the amount or add funds.');const actor=state.account;const allowance=await publicClient.readContract({address:USDC,abi:erc20Abi,functionName:'allowance',args:[actor,state.registry]});if(allowance<amount){state.step='Approve only this USDC amount in your wallet';emit();const {request}=await publicClient.simulateContract({address:USDC,abi:erc20Abi,functionName:'approve',args:[state.registry,amount],account:actor});await wait(await wallet.writeContract(request),'Confirming USDC approval…');}if(state.account!==actor)throw Error('Account changed during approval. Reconnect and review the payment.');b=await loadBill(id);if(b.status!=='active'||amount>b.remaining)throw Error('Someone else paid while you approved. Review the remaining amount; no payment was sent.');return write('contribute',[BigInt(id),amount]);});}
export async function cancelBill(id){return task(()=>write('cancel',[BigInt(id)]));}
export async function refundBill(id){return task(()=>write('claimRefund',[BigInt(id)]));}
export async function sendUSDC(to,amount){return task(async()=>{if(!isAddress(to)||/^0x0{40}$/i.test(to))throw Error('Enter a valid recipient wallet.');const recipient=getAddress(to);const wallet=await ensureArc();if(recipient===state.account)throw Error('Recipient is the connected wallet. Enter a different address.');await checkNetwork();await refreshWallet();const [gas,price]=await Promise.all([publicClient.estimateContractGas({address:USDC,abi:erc20Abi,functionName:'transfer',args:[recipient,amount],account:state.account}),publicClient.getGasPrice()]);if(state.balance<requiredBalance(amount,gas*price))throw Error('Insufficient USDC for the transfer plus a network-fee safety buffer. Reduce the amount or add funds.');const {request}=await publicClient.simulateContract({address:USDC,abi:erc20Abi,functionName:'transfer',args:[recipient,amount],account:state.account});state.step='Confirm USDC transfer';emit();return wait(await wallet.writeContract(request),'Waiting for transfer confirmation…');});}
export async function estimateSend(to,amount){if(!state.account)throw Error('Connect your wallet first.');if(!isAddress(to)||/^0x0{40}$/i.test(to))throw Error('Invalid recipient.');const recipient=getAddress(to);if(recipient===state.account)throw Error('Recipient is the connected wallet. Enter a different address.');const [gas,price]=await Promise.all([publicClient.estimateContractGas({address:USDC,abi:erc20Abi,functionName:'transfer',args:[recipient,amount],account:state.account}),publicClient.getGasPrice()]);return formatUnits(gas*price,18);}
export {artifact,USDC,EXPLORER,WC_PROJECT_ID};

export async function autoConnect(){
 const id=localStorage.getItem('arrey-wallet-id');
 if(!id)return;
 if(id==='walletconnect'){try{await connect(id);}catch(e){}}
 else{
  setTimeout(async()=>{
   const d=getProviders().find(p=>p.info.uuid===id);
   if(!d)return;
   try{
    const accounts=await d.provider.request({method:'eth_accounts'});
    if(accounts&&accounts.length>0)await connect(id);
   }catch(e){}
  },300);
 }
}
