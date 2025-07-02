import { ABIParameter } from './types.ts';


export function isDynamicType(params: ABIParameter): boolean {
	if (params.type === 'string' || params.type === 'bytes') return true;

	if (/\[\]$/.test(params.type)) return true;

	if (params.type === 'tuple') {
		if (!params.components) throw new Error('Tuple must have components');
		return params.components.some(isDynamicType);
	}

	return false;
}

