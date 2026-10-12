export function jpegDimensions(bytes: Buffer) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid rendered JPEG");
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xff || marker === 0x00) { offset++; continue; }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    offset += length + 2;
  }
  throw new Error("Rendered JPEG dimensions are unavailable");
}
