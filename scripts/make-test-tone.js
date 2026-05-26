const fs = require("fs");
const path = require("path");

const rate = 22050;
const dur = 2;
const freq = 440;
const n = rate * dur;
const data = Buffer.alloc(44 + n * 2);
data.write("RIFF", 0);
data.writeUInt32LE(36 + n * 2, 4);
data.write("WAVE", 8);
data.write("fmt ", 12);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(rate, 24);
data.writeUInt32LE(rate * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const s = Math.sin((2 * Math.PI * freq * i) / rate) * 0.4;
  data.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
}
const out = path.join(__dirname, "..", "assets", "test-tone.wav");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, data);
console.log("Wrote", out);
