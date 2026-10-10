import { test } from "node:test";
import assert from "node:assert/strict";
import { namespaceFilter } from "./namespace-filter.mjs";

// Execute the emitted classic BPF bytecode against independent ABI examples.
function decision(number, { arch = 0xc000003e, flags = 0, ioctl = 0 } = {}) {
  const program = namespaceFilter();
  const data = Buffer.alloc(64);
  data.writeUInt32LE(number, 0);
  data.writeUInt32LE(arch, 4);
  data.writeUInt32LE(flags, 16);
  data.writeUInt32LE(ioctl, 24);
  let accumulator = 0;
  for (let pc = 0; pc < program.length / 8; pc++) {
    const offset = pc * 8;
    const code = program.readUInt16LE(offset);
    const yes = program[offset + 2];
    const no = program[offset + 3];
    const value = program.readUInt32LE(offset + 4);
    if (code === 0x20) accumulator = data.readUInt32LE(value);
    else if (code === 0x15) pc += accumulator === value ? yes : no;
    else if (code === 0x45) pc += (accumulator & value) !== 0 ? yes : no;
    else if (code === 0x06) return value;
    else throw Error("Unsupported BPF instruction");
  }
  throw Error("Policy did not terminate");
}
test("ordinary Node file, process and HTTP calls remain available", () => {
  for (const number of [
    0, 1, 9, 13, 39, 41, 42, 49, 50, 57, 59, 60, 61, 202, 217, 257, 262, 291,
    318, 332, 436, 437,
  ])
    assert.equal(decision(number), 0x7fff0000, number);
});
test("new namespaces, tracing, mount operations and privileged kernel interfaces are blocked", () => {
  for (const number of [
    101, 155, 165, 166, 169, 175, 176, 248, 249, 250, 272, 298, 304, 308, 310,
    311, 313, 320, 321, 323, 425, 426, 427, 428, 429, 430, 431, 432, 433, 438,
    442, 999,
  ])
    assert.equal(decision(number), 0x50001, number);
});
test("pthread clone is available while all namespace clone flags are denied", () => {
  assert.equal(decision(56, { flags: 0x3d0f00 }), 0x7fff0000);
  for (const flags of [
    0x20000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000,
    0x40000000,
  ])
    assert.equal(decision(56, { flags }), 0x50001);
  assert.equal(
    decision(435),
    0x50026,
    "clone3 must allow libc to fall back safely",
  );
});
test("alternate architectures and x32 ABI cannot bypass syscall policy", () => {
  assert.equal(decision(0, { arch: 0x40000003 }), 0x80000000);
  assert.equal(decision(0x40000000 + 101), 0x50026);
});
test("terminal injection ioctls are denied while normal pipe/device inspection remains available", () => {
  assert.equal(decision(16, { ioctl: 0x5412 }), 0x50001);
  assert.equal(decision(16, { ioctl: 0x541c }), 0x50001);
  assert.equal(decision(16, { ioctl: 0x5401 }), 0x7fff0000);
});
