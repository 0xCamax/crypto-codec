export function bigintToHex(value: bigint): string {
  return "0x" + value.toString(16);
}