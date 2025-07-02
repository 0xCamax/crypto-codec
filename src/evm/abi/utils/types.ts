type StateMutability = "pure" | "view" | "nonpayable" | "payable";
type FunctionType = "function" | "constructor" | "receive" | "fallback";

/**
 * A parameter in a function's input/output list
 */
export interface ABIParameter {
  name?: string;
  type: string; // canonical Solidity type
  components?: ABIParameter[]; // for tuples (structs)
  internalType?: string; // optional, used in full compiler output
}

/**
 * Function, constructor, receive, or fallback declaration
 */
export interface ABIFunction {
  type: FunctionType;
  name?: string; // not present for "fallback" or "receive"
  inputs: ABIParameter[];
  outputs?: ABIParameter[]; // only for type: "function"
  stateMutability?: StateMutability;
  constant?: boolean; // legacy field
  payable?: boolean;  // legacy field
}

/**
 * Event declaration
 */
export interface ABIEvent {
  type: "event";
  name?: string;
  inputs: (ABIParameter & { indexed?: boolean })[];
  anonymous?: boolean;
}

/**
 * Error declaration (custom errors from Solidity >= 0.8.4)
 */
export interface ABIError {
  type: "error";
  name: string;
  inputs: ABIParameter[];
}

/**
 * Full ABI definition
 */
type ABIElement = ABIFunction | ABIEvent | ABIError;

export type ContractABI = ABIElement[];
