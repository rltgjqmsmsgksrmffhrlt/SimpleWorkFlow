const path = require("path");

// When packaged with pkg, __dirname points inside the read-only snapshot,
// so writable files (data.json, the extracted cloudflared.exe) must live
// next to the actual .exe on real disk instead.
const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

module.exports = { baseDir };
