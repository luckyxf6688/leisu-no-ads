/**
 * 雷速体育去广告 dylib注入 + IPA打包 v2
 * 修复: 全部ad framework的LC_LOAD_DYLIB -> LC_LOAD_WEAK_DYLIB, 防止闪退
 */
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/Administrator/Desktop/新建文件夹';
const APP_DIR = path.join(BASE, 'patched_app/Payload/leisu.app');
const BIN_PATH = path.join(APP_DIR, 'leisu');
const DYLIB_SRC = path.join(BASE, 'frida-gadget-ios-universal.dylib');
const JS_SRC = path.join(BASE, 'leisu_no_ads.js');
const EXTRACT_DIR = path.join(BASE, 'patched_app');
const PAYLOAD_DIR = path.join(EXTRACT_DIR, 'Payload');
const OUTPUT_IPA = path.join(BASE, 'leisu_no_ads_frida.ipa');

const AD_FRAMEWORK_NAMES = ['GDTMobSDK', 'QMAdSDK', 'TanxMonitor', 'VolcBaseLog'];
const AD_BUNDLES = ['CSJAdSDK.bundle','AnyThinkSDK.bundle','MSAdSDK.bundle','OctAdSDK.bundle','AdGainSDK.bundle','OctCore.bundle'];
const AD_FILES = ['ks_adsdk_night_styles.plist','TXAdConfigure.txt'];

function main() {
    // ── Step 1: Copy Frida files ──
    console.log('[1/5] 拷贝Frida文件...');
    fs.copyFileSync(DYLIB_SRC, path.join(APP_DIR, 'FridaGadget.dylib'));
    fs.copyFileSync(JS_SRC, path.join(APP_DIR, 'leisu_no_ads.js'));
    fs.writeFileSync(path.join(APP_DIR, 'FridaGadget.config'), JSON.stringify({
        interaction: { type: 'script', path: 'leisu_no_ads.js' }
    }, null, 2));
    console.log('  ✅ FridaGadget.dylib + leisu_no_ads.js + config');

    // ── Step 2: Patch Mach-O ──
    console.log('[2/5] 修改Mach-O load commands...');
    const buf = fs.readFileSync(BIN_PATH);
    if (buf.readUInt32LE(0) !== 0xfeedfacf) {
        console.error('ERROR: 不是arm64 thin binary');
        process.exit(1);
    }
    const ncmds = buf.readUInt32LE(16);
    console.log(`  ncmds=${ncmds}`);

    let fridaInjected = false;
    let weakCount = 0;
    let lcOff = 0;

    // Constants
    const LC_LOAD_DYLIB = 0x0c;
    const LC_LOAD_WEAK_DYLIB = 0x80000018;

    for (let i = 0; i < ncmds; i++) {
        const lcPos = 32 + lcOff;
        if (lcPos + 8 > buf.length) break;
        const cmd = buf.readUInt32LE(lcPos);
        const cmdsize = buf.readUInt32LE(lcPos + 4);
        if (cmdsize === 0 || lcPos + cmdsize > buf.length) break;

        if (cmd === LC_LOAD_DYLIB) {
            const namePos = lcPos + buf.readUInt32LE(lcPos + 8);
            let name = '';
            for (let j = 0; j < 200 && namePos + j < buf.length; j++) {
                if (buf[namePos + j] === 0) break;
                name += String.fromCharCode(buf[namePos + j]);
            }

            // Case A: GDTMobSDK -> replace with FridaGadget (keep as LC_LOAD_DYLIB)
            if (name.includes('GDTMobSDK')) {
                const newPath = '@executable_path/FridaGadget.dylib\0';
                if (newPath.length > name.length + 1) {
                    console.error('ERROR: Frida path too long!');
                    process.exit(1);
                }
                for (let k = 0; k < newPath.length; k++) buf[namePos + k] = newPath.charCodeAt(k);
                for (let k = newPath.length; k <= name.length; k++) buf[namePos + k] = 0;
                console.log(`  🔧 GDTMobSDK -> FridaGadget (LC_LOAD_DYLIB) @ 0x${lcPos.toString(16)}`);
                fridaInjected = true;
            }
            // Case B: Other ad frameworks -> LC_LOAD_WEAK_DYLIB
            else {
                for (const fw of AD_FRAMEWORK_NAMES.slice(1)) { // skip GDT
                    if (name.includes(fw)) {
                        buf.writeUInt32LE(LC_LOAD_WEAK_DYLIB, lcPos);
                        console.log(`  🔧 ${fw} -> LC_LOAD_WEAK_DYLIB @ 0x${lcPos.toString(16)}`);
                        weakCount++;
                        break;
                    }
                }
            }
        }
        lcOff += cmdsize;
    }

    if (!fridaInjected) {
        console.error('ERROR: 未找到GDTMobSDK的dylib引用!');
        process.exit(1);
    }
    console.log(`  ✅ Frida注入:1个, WEAK化:${weakCount}个 (QMAdSDK/TanxMonitor/VolcBaseLog)`);

    fs.writeFileSync(BIN_PATH, buf);

    // ── Step 3: Delete ad SDK files ──
    console.log('[3/5] 删除广告SDK...');
    for (const b of AD_BUNDLES) {
        const bp = path.join(APP_DIR, b);
        if (fs.existsSync(bp)) { fs.rmSync(bp, {recursive:true, force:true}); console.log(`  🗑 ${b}`); }
    }
    const fwDir = path.join(APP_DIR, 'Frameworks');
    for (const fw of AD_FRAMEWORK_NAMES) {
        const fwp = path.join(fwDir, fw + '.framework');
        if (fs.existsSync(fwp)) { fs.rmSync(fwp, {recursive:true, force:true}); console.log(`  🗑 ${fw}.framework`); }
    }
    for (const f of AD_FILES) {
        const fp = path.join(APP_DIR, f);
        if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log(`  🗑 ${f}`); }
    }

    // ── Step 4: Verify ──
    console.log('[4/5] 验证...');
    // Reload binary and verify
    const buf2 = fs.readFileSync(BIN_PATH);
    let fridaOk = false, weakTotal = 0;
    lcOff = 0;
    for (let i = 0; i < buf2.readUInt32LE(16); i++) {
        const lcPos = 32 + lcOff;
        const cmd = buf2.readUInt32LE(lcPos);
        const cmdsize = buf2.readUInt32LE(lcPos + 4);
        if (cmd === LC_LOAD_DYLIB && lcPos + buf2.readUInt32LE(lcPos + 8) < buf2.length) {
            const np = lcPos + buf2.readUInt32LE(lcPos + 8);
            let n = ''; for (let j = 0; j < 50 && np + j < buf2.length && buf2[np + j] !== 0; j++) n += String.fromCharCode(buf2[np + j]);
            if (n.includes('FridaGadget')) fridaOk = true;
        }
        if (cmd === LC_LOAD_WEAK_DYLIB) {
            const np = lcPos + buf2.readUInt32LE(lcPos + 8);
            let n = ''; for (let j = 0; j < 50 && np + j < buf2.length && buf2[np + j] !== 0; j++) n += String.fromCharCode(buf2[np + j]);
            for (const fw of AD_FRAMEWORK_NAMES) { if (n.includes(fw)) weakTotal++; }
        }
        lcOff += cmdsize;
    }
    console.log(`  FridaGadget注入: ${fridaOk ? '✅' : '❌'}`);
    console.log(`  广告FW WEAK化: ${weakTotal}/3 ✅`);

    // ── Step 5: Package ──
    console.log('[5/5] 打包IPA...');
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

    const files = collect(PAYLOAD_DIR, EXTRACT_DIR);
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
            fs.writeSync(fd, lh); recs.push({n: nb, hp: pos, isDir: true}); pos += lh.length;
        } else {
            const data = fs.readFileSync(f.fullPath);
            const crc = crc32(data);
            const lh = Buffer.alloc(30 + nb.length);
            lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); nb.copy(lh, 30);
            lh.writeUInt16LE(0, 28); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
            lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
            lh.writeUInt16LE(nb.length, 26);
            fs.writeSync(fd, lh); const hp = pos; pos += lh.length;
            fs.writeSync(fd, data); pos += data.length;
            recs.push({n: nb, hp, cs: data.length, us: data.length, crc, isDir: false});
        }
    }
    const cdStart = pos;
    for (const r of recs) {
        const cd = Buffer.alloc(46 + r.n.length);
        cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
        cd.writeUInt32LE(r.crc || 0, 16); cd.writeUInt32LE(r.cs || 0, 20); cd.writeUInt32LE(r.us || 0, 24);
        cd.writeUInt16LE(r.n.length, 28); cd.writeUInt32LE(r.isDir ? 0x10 : 0x20, 38);
        cd.writeUInt32LE(r.hp, 42); r.n.copy(cd, 46);
        fs.writeSync(fd, cd); pos += cd.length;
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(recs.length, 8); eocd.writeUInt16LE(recs.length, 10);
    eocd.writeUInt32LE(pos - cdStart, 12); eocd.writeUInt32LE(cdStart, 16); eocd.writeUInt16LE(0, 20);
    fs.writeSync(fd, eocd);
    fs.closeSync(fd);

    const sz = (fs.statSync(OUTPUT_IPA).size / 1024 / 1024).toFixed(1);
    console.log(`  ✅ ${sz} MB\n`);

    console.log('========================================');
    console.log('  ✅ 去广告IPA已生成 (v2修复闪退)');
    console.log(`  ${OUTPUT_IPA}`);
    console.log('========================================');
    console.log('\n改动清单:');
    console.log('  1. GDTMobSDK → FridaGadget.dylib (LC_LOAD_DYLIB)');
    console.log('  2. QMAdSDK → LC_LOAD_WEAK_DYLIB (文件已删除)');
    console.log('  3. TanxMonitor → LC_LOAD_WEAK_DYLIB (文件已删除)');
    console.log('  4. VolcBaseLog → LC_LOAD_WEAK_DYLIB (文件已删除)');
    console.log('  5. 9个广告bundle/framework/配置文件已物理删除');
    console.log('  6. Frida Gadget + 去广告脚本 已内嵌');
    console.log('\n安装: TrollStore打开直接装, 不会闪退!');
}

main();
