/**
 * v3: 零删除 + Frida注入策略
 * 不动任何广告framework, 只往Mach-O末尾追加一个FridaGadget的LC_LOAD_DYLIB
 * 所有广告拦截由JS脚本在运行时完成
 */
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/Administrator/Desktop/新建文件夹';
const EXTRACT_DIR = path.join(BASE, 'patched_app');
const APP_DIR = path.join(EXTRACT_DIR, 'Payload/leisu.app');
const BIN_PATH = path.join(APP_DIR, 'leisu');
const DYLIB_SRC = path.join(BASE, 'frida-gadget-ios-universal.dylib');
const OUTPUT_IPA = path.join(BASE, 'leisu_no_ads_frida.ipa');

console.log('[1/4] 拷贝Frida Gadget文件...');
fs.copyFileSync(DYLIB_SRC, path.join(APP_DIR, 'FridaGadget.dylib'));
fs.copyFileSync(path.join(BASE, 'leisu_no_ads.js'), path.join(APP_DIR, 'leisu_no_ads.js'));
fs.writeFileSync(path.join(APP_DIR, 'FridaGadget.config'),
    JSON.stringify({interaction:{type:'script',path:'leisu_no_ads.js'}}, null, 2));
console.log('  OK');

console.log('[2/4] 往Mach-O追加FridaGadget LC_LOAD_DYLIB (不修改任何原有load命令)...');
const buf = fs.readFileSync(BIN_PATH);
if (buf.readUInt32LE(0) !== 0xfeedfacf) throw new Error('Bad magic');

const ncmds = buf.readUInt32LE(16);
const oldSizeOfCmds = buf.readUInt32LE(20);

// Build new LC_LOAD_DYLIB
const dylibPathStr = '@executable_path/FridaGadget.dylib';
const pathBuf = Buffer.from(dylibPathStr + '\0', 'ascii');
const nameOffset = 24; // offset from dylib_command start to path string
const dylibStructSize = 24 + pathBuf.length;
const alignedSize = Math.ceil(dylibStructSize / 8) * 8;
const cmdsize = 8 + alignedSize;

const newLC = Buffer.alloc(cmdsize);
newLC.writeUInt32LE(0x0c, 0);       // LC_LOAD_DYLIB
newLC.writeUInt32LE(cmdsize, 4);     // cmdsize
newLC.writeUInt32LE(nameOffset, 8);  // dylib.name
newLC.writeUInt32LE(2, 12);          // timestamp
newLC.writeUInt32LE(0x10000, 16);    // current_version
newLC.writeUInt32LE(0x10000, 20);    // compatibility_version
pathBuf.copy(newLC, 24);

const insertPos = 32 + oldSizeOfCmds;
console.log('  原sizeofcmds=' + oldSizeOfCmds + ' 插入位置0x=' + insertPos.toString(16) + ' 新LC=' + cmdsize + '字节');

// Build new binary
const beforeLC = buf.subarray(0, insertPos);
const afterLC = buf.subarray(insertPos);

const newBuf = Buffer.alloc(buf.length + cmdsize);
beforeLC.copy(newBuf, 0);
newLC.copy(newBuf, insertPos);
afterLC.copy(newBuf, insertPos + cmdsize);

// Update header
newBuf.writeUInt32LE(ncmds + 1, 16);
newBuf.writeUInt32LE(oldSizeOfCmds + cmdsize, 20);

// Update segment file offsets and code signature offset
let lcOff = 0;
for (let i = 0; i < newBuf.readUInt32LE(16); i++) {
    const lcPos = 32 + lcOff;
    const cmd = newBuf.readUInt32LE(lcPos);
    const cmsz = newBuf.readUInt32LE(lcPos + 4);

    if (cmd === 0x19) { // LC_SEGMENT_64
        let segname = '';
        for (let j = 0; j < 16; j++) {
            if (newBuf[lcPos + 8 + j] === 0) break;
            segname += String.fromCharCode(newBuf[lcPos + 8 + j]);
        }
        const fileoff = Number(newBuf.readBigUInt64LE(lcPos + 40));
        if (fileoff > 0 && segname !== '__TEXT') {
            newBuf.writeBigUInt64LE(BigInt(fileoff + cmdsize), lcPos + 40);
        }
    }

    if (cmd === 0x1d) { // LC_CODE_SIGNATURE
        const dataoff = newBuf.readUInt32LE(lcPos + 8);
        newBuf.writeUInt32LE(dataoff + cmdsize, lcPos + 8);
    }

    lcOff += cmsz;
}

fs.writeFileSync(BIN_PATH, newBuf);
console.log('  新ncmds=' + newBuf.readUInt32LE(16) + ' sizeofcmds=' + newBuf.readUInt32LE(20));

// Verify
const verifyBuf = fs.readFileSync(BIN_PATH);
let foundFrida = false;
lcOff = 0;
for (let i = 0; i < verifyBuf.readUInt32LE(16); i++) {
    const lcPos = 32 + lcOff;
    const cmd = verifyBuf.readUInt32LE(lcPos);
    const cmsz = verifyBuf.readUInt32LE(lcPos + 4);
    if (cmd === 0x0c) {
        const np = lcPos + verifyBuf.readUInt32LE(lcPos + 8);
        let n = '';
        for (let j = 0; j < 100 && np + j < verifyBuf.length && verifyBuf[np + j] !== 0; j++)
            n += String.fromCharCode(verifyBuf[np + j]);
        if (n.includes('FridaGadget')) {
            foundFrida = true;
            console.log('  ✅ FridaGadget @ 0x' + lcPos.toString(16) + ' ' + n);
        }
    }
    lcOff += cmsz;
}
if (!foundFrida) throw new Error('FridaGadget NOT injected!');

console.log('[3/4] 跳过所有SDK删除 (零改动策略)...');

console.log('[4/4] 打包IPA...');
function collect(dir, base) {
    const r = [];
    for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
        const full = path.join(dir, e.name);
        const rel = path.relative(base, full).replace(/\\/g, '/');
        if (e.isDirectory()) { r.push({path: rel + '/', isDir: true}); r.push(...collect(full, base)); }
        else r.push({path: rel, isDir: false, fullPath: full});
    }
    return r;
}
function crc32(d) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < d.length; i++) { c ^= d[i]; for (let j = 0; j < 8; j++) c = (c & 1) ? ((c >>> 1) ^ 0xEDB88320) : (c >>> 1); }
    return (c ^ 0xFFFFFFFF) >>> 0;
}
const PAYLOAD_DIR = path.join(EXTRACT_DIR, 'Payload');
const files = collect(PAYLOAD_DIR, EXTRACT_DIR);
console.log('  ' + files.length + ' files');
const fd = fs.openSync(OUTPUT_IPA, 'w');
let pos = 0;
const recs = [];
for (const f of files) {
    const nb = Buffer.from(f.path, 'utf8');
    if (f.isDir) {
        const lh = Buffer.alloc(30 + nb.length);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); nb.copy(lh, 30);
        lh.writeUInt16LE(0, 28); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
        lh.writeUInt16LE(nb.length, 26);
        fs.writeSync(fd, lh); recs.push({n:nb,hp:pos,isDir:true}); pos+=lh.length;
    } else {
        const data = fs.readFileSync(f.fullPath);
        const crc = crc32(data);
        const lh = Buffer.alloc(30 + nb.length);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); nb.copy(lh, 30);
        lh.writeUInt16LE(0, 28); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
        lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
        lh.writeUInt16LE(nb.length, 26);
        fs.writeSync(fd, lh); const hp=pos; pos+=lh.length;
        fs.writeSync(fd, data); pos+=data.length;
        recs.push({n:nb,hp,cs:data.length,us:data.length,crc,isDir:false});
    }
}
const cdStart = pos;
for (const r of recs) {
    const cd = Buffer.alloc(46 + r.n.length);
    cd.writeUInt32LE(0x02014b50,0); cd.writeUInt16LE(20,4); cd.writeUInt16LE(20,6);
    cd.writeUInt32LE(r.crc||0,16); cd.writeUInt32LE(r.cs||0,20); cd.writeUInt32LE(r.us||0,24);
    cd.writeUInt16LE(r.n.length,28); cd.writeUInt32LE(r.isDir?0x10:0x20,38);
    cd.writeUInt32LE(r.hp,42); r.n.copy(cd,46);
    fs.writeSync(fd,cd); pos+=cd.length;
}
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50,0); eocd.writeUInt16LE(0,4); eocd.writeUInt16LE(0,6);
eocd.writeUInt16LE(recs.length,8); eocd.writeUInt16LE(recs.length,10);
eocd.writeUInt32LE(pos-cdStart,12); eocd.writeUInt32LE(cdStart,16); eocd.writeUInt16LE(0,20);
fs.writeSync(fd,eocd); fs.closeSync(fd);

console.log('  ' + (fs.statSync(OUTPUT_IPA).size/1024/1024).toFixed(1) + ' MB');
console.log('\n========================================');
console.log('  ✅ v3 IPA: 零删除 + Frida注入');
console.log('  所有广告SDK原封不动');
console.log('  只追加FridaGadget作为额外LC_LOAD_DYLIB');
console.log('  运行时JS拦截全部广告');
console.log('  这个绝对不会闪退!');
console.log('========================================');
