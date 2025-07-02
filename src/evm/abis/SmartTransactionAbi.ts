import { ChainlinkSmartAccount } from './ChainlinkSmartAccount.ts';

export const SmartTransactionAbi = ChainlinkSmartAccount.filter(
	(abi) => abi.type == 'function'
).filter((fn) => fn.name!.includes('execute'));
