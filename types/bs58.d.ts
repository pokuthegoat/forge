declare module "bs58" {
  function encode(buffer: Uint8Array | number[] | Buffer): string;
  function decode(input: string): Buffer;
  const bs58: { encode: typeof encode; decode: typeof decode };
  export default bs58;
}
