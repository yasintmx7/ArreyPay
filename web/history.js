const KEY='arrey-confirmed-transfers-v1';
const ACTIONS_KEY='arrey-confirmed-actions-v1';
const address=/^0x[a-fA-F0-9]{40}$/;
const hash=/^0x[a-fA-F0-9]{64}$/;

function validRows(storage){
 try{
  const rows=JSON.parse(storage.getItem(KEY)||'[]');
  if(!Array.isArray(rows))return [];
  return rows.filter(row=>row&&typeof row.hash==='string'&&hash.test(row.hash)&&typeof row.from==='string'&&address.test(row.from)&&typeof row.to==='string'&&address.test(row.to)&&typeof row.amount==='string'&&/^\d+$/.test(row.amount)&&BigInt(row.amount)>0n&&Number.isFinite(row.recordedAt)&&row.recordedAt>0);
 }catch{return [];}
}
export function getTransfers(account,storage){
 if(!account||!address.test(account))return [];
 try{return validRows(storage??globalThis.localStorage).filter(row=>row.from.toLowerCase()===account.toLowerCase()).sort((a,b)=>b.recordedAt-a.recordedAt);}catch{return [];}
}

export function saveTransfer({hash:txHash,from,to,amount},storage,recordedAt=Date.now()){
 if(!hash.test(txHash)||!address.test(from)||!address.test(to)||BigInt(amount)<=0n||!Number.isFinite(recordedAt)||recordedAt<=0)throw Error('Cannot save an invalid transfer receipt.');
 try{
  storage??=globalThis.localStorage;
  const existing=validRows(storage);
  if(existing.some(row=>row.hash.toLowerCase()===txHash.toLowerCase()))return true;
  storage.setItem(KEY,JSON.stringify([...existing,{hash:txHash,from,to,amount:String(amount),recordedAt}]));
  return true;
 }catch{return false;}
}

const actionTypes=new Set(['created','contributed','cancelled','refunded']);
function validActions(storage){
 try{
  const rows=JSON.parse(storage.getItem(ACTIONS_KEY)||'[]');
  if(!Array.isArray(rows))return [];
  return rows.filter(row=>row&&hash.test(row.hash)&&address.test(row.account)&&actionTypes.has(row.type)&&/^\d+$/.test(row.billId)&&(!row.amount||/^\d+$/.test(row.amount))&&typeof row.title==='string'&&Number.isFinite(row.recordedAt)&&row.recordedAt>0);
 }catch{return [];}
}
export function getActions(account,storage){
 if(!account||!address.test(account))return [];
 try{return validActions(storage??globalThis.localStorage).filter(row=>row.account.toLowerCase()===account.toLowerCase()).sort((a,b)=>b.recordedAt-a.recordedAt);}catch{return [];}
}
export function saveAction({hash:txHash,account,type,billId,amount,title},storage,recordedAt=Date.now()){
 if(!hash.test(txHash)||!address.test(account)||!actionTypes.has(type)||!/^\d+$/.test(String(billId))||!Number.isFinite(recordedAt)||recordedAt<=0)throw Error('Cannot save an invalid checkout action.');
 try{
  storage??=globalThis.localStorage;
  const existing=validActions(storage);
  if(existing.some(row=>row.hash.toLowerCase()===txHash.toLowerCase()))return true;
  existing.push({hash:txHash,account,type,billId:String(billId),amount:amount==null?null:String(amount),title:String(title||'').slice(0,120),recordedAt});
  storage.setItem(ACTIONS_KEY,JSON.stringify(existing));
  return true;
 }catch{return false;}
}
