import fs from 'node:fs';
import solc from 'solc';
const sources=Object.fromEntries(['ArreyCheckout.sol','MockUSDC.sol'].map(n=>[n,{content:fs.readFileSync('contracts/'+n,'utf8')}]));
const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',metadata:{bytecodeHash:'none'},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
for(const error of output.errors||[]){if(error.severity==='error')throw Error(error.formattedMessage);}
fs.mkdirSync('web/generated',{recursive:true});fs.mkdirSync('artifacts',{recursive:true});
for(const n of ['ArreyCheckout','MockUSDC']){const c=output.contracts[n+'.sol'][n];const artifact={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object};fs.writeFileSync('artifacts/'+n+'.json',JSON.stringify(artifact));if(n==='ArreyCheckout')fs.writeFileSync('web/generated/contract.json',JSON.stringify(artifact));}
fs.writeFileSync('artifacts/compiler-input.json',JSON.stringify(input,null,2));
console.log('Contracts compiled using',solc.version());
