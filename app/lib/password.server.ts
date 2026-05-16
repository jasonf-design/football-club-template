import { hash, verify } from "@node-rs/argon2";

const PARAMS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(plain: string) {
  return hash(plain, PARAMS);
}

export function verifyPassword(stored: string, plain: string) {
  return verify(stored, plain, PARAMS);
}
