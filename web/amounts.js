export function parseAmount(value){
 if(typeof value!=='string'||!/^\d+(\.\d{1,6})?$/.test(value.trim()))throw Error('Use a positive USDC amount with up to 6 decimal places.');
 const [whole,fraction='']=value.trim().split('.');const amount=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
 if(amount<=0n||amount>1000000000000n)throw Error('Amount must be between 0.000001 and 1,000,000 USDC.');return amount;
}
export function formatAmount(amount){const n=BigInt(amount);const fraction=(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'').padEnd(2,'0');return `${n/1000000n}.${fraction}`;}
export function equalShare(target,people,already=0n,remaining=target){const n=BigInt(people);const suggested=(BigInt(target)+n-1n)/n-BigInt(already);return suggested<=0n?0n:suggested>remaining?remaining:suggested;}
