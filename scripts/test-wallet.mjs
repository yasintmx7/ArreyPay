import fs from 'node:fs';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
const file='.test-wallet.json';
if(!fs.existsSync(file)){const privateKey=generatePrivateKey();fs.writeFileSync(file,JSON.stringify({privateKey,address:privateKeyToAccount(privateKey).address}),{mode:0o600});}
const {address}=JSON.parse(fs.readFileSync(file,'utf8'));console.log(address);
