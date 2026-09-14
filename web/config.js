import {deployedContract} from './deployment.js';
export const ARC_ID = 5042002;
export const ARC_RPC = 'https://rpc.testnet.arc.io';
export const EXPLORER = 'https://testnet.arcscan.app';
export const USDC = '0x3600000000000000000000000000000000000000';
export const DEFAULT_CONTRACT = import.meta.env.VITE_ARREY_CONTRACT || deployedContract;
export const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
