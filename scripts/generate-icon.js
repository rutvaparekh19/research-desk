const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
}

function createPng(size) {
    const width = size;
    const height = size;
    const rawData = Buffer.alloc(height * (1 + width * 4));

    const radius = size * 0.22;
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;

    for (let y = 0; y < height; y++) {
        const rowOffset = y * (1 + width * 4);
        rawData[rowOffset] = 0; // Filter type None

        for (let x = 0; x < width; x++) {
            const pixelOffset = rowOffset + 1 + x * 4;

            // Rounded rectangle test
            const dx = Math.max(0, Math.abs(x - cx) - (cx - radius));
            const dy = Math.max(0, Math.abs(y - cy) - (cy - radius));
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
                // Inside badge background: Slate-indigo gradient (#1e293b to #0f172a)
                const t = y / height;
                let r = Math.round(30 * (1 - t) + 15 * t);
                let g = Math.round(41 * (1 - t) + 23 * t);
                let b = Math.round(59 * (1 - t) + 42 * t);
                let a = 255;

                // Subtle anti-aliasing on badge edge
                if (dist > radius - 1) {
                    a = Math.round(255 * (radius - dist));
                }

                // Inner notebook / research sheet icon:
                // Draw a stylized white notebook / folded document
                const docLeft = Math.round(width * 0.26);
                const docRight = Math.round(width * 0.74);
                const docTop = Math.round(height * 0.22);
                const docBottom = Math.round(height * 0.78);

                if (x >= docLeft && x <= docRight && y >= docTop && y <= docBottom) {
                    // Document body (#ffffff / #f8fafc)
                    r = 248;
                    g = 250;
                    b = 252;

                    // Accent header bar on document (#3b82f6 - vibrant blue)
                    if (y <= docTop + Math.max(2, Math.round(height * 0.12))) {
                        r = 59;
                        g = 130;
                        b = 246;
                    } else {
                        // Document lines (amber / gray detail)
                        const lineSpacing = Math.max(3, Math.round(height * 0.1));
                        const lineStart = docTop + Math.round(height * 0.22);
                        const relY = y - lineStart;
                        if (relY >= 0 && relY % lineSpacing < Math.max(1, Math.round(height * 0.035)) && y < docBottom - Math.round(height * 0.1)) {
                            if (x >= docLeft + Math.round(width * 0.08) && x <= docRight - Math.round(width * 0.08)) {
                                r = 148;
                                g = 163;
                                b = 184;
                            }
                        }
                    }
                }

                rawData[pixelOffset] = r;
                rawData[pixelOffset + 1] = g;
                rawData[pixelOffset + 2] = b;
                rawData[pixelOffset + 3] = a;
            } else {
                // Transparent
                rawData[pixelOffset] = 0;
                rawData[pixelOffset + 1] = 0;
                rawData[pixelOffset + 2] = 0;
                rawData[pixelOffset + 3] = 0;
            }
        }
    }

    const compressed = zlib.deflateSync(rawData);

    // PNG signature
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8); // bit depth
    ihdrData.writeUInt8(6, 9); // color type RGBA
    ihdrData.writeUInt8(0, 10); // compression
    ihdrData.writeUInt8(0, 11); // filter
    ihdrData.writeUInt8(0, 12); // interlace

    const ihdr = makeChunk("IHDR", ihdrData);
    const idat = makeChunk("IDAT", compressed);
    const iend = makeChunk("IEND", Buffer.alloc(0));

    return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, "ascii");
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
}

function createIco(pngBuffers) {
    const count = pngBuffers.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // 1 = ICO
    header.writeUInt16LE(count, 4); // number of images

    const dirEntries = [];
    let offset = 6 + count * 16;

    for (const item of pngBuffers) {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(item.size >= 256 ? 0 : item.size, 0); // width (0 = 256)
        entry.writeUInt8(item.size >= 256 ? 0 : item.size, 1); // height
        entry.writeUInt8(0, 2); // color palette
        entry.writeUInt8(0, 3); // reserved
        entry.writeUInt16LE(1, 4); // color planes
        entry.writeUInt16LE(32, 6); // bits per pixel
        entry.writeUInt32LE(item.buffer.length, 8); // image size
        entry.writeUInt32LE(offset, 12); // offset

        dirEntries.push(entry);
        offset += item.buffer.length;
    }

    return Buffer.concat([
        header,
        ...dirEntries,
        ...pngBuffers.map((item) => item.buffer)
    ]);
}

function generateIcons() {
    const assetsDir = path.join(__dirname, "..", "assets");
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = sizes.map((size) => ({
        size,
        buffer: createPng(size)
    }));

    const png256 = pngBuffers.find((p) => p.size === 256).buffer;
    fs.writeFileSync(path.join(assetsDir, "icon.png"), png256);

    const ico = createIco(pngBuffers);
    fs.writeFileSync(path.join(assetsDir, "icon.ico"), ico);

    console.log("Successfully generated assets/icon.png and assets/icon.ico");
}

generateIcons();
