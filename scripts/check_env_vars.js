import fs from 'fs';
try {
    const p = '.env';
    if (fs.existsSync(p)) {
        const c = fs.readFileSync(p, 'utf8');
        const k = c.split('\n').map(x => x.split('=')[0].trim()).filter(k => k && !k.startsWith('#'));
        console.log('ENV_KEYS:', JSON.stringify(k));
    } else {
        console.log('NO_.ENV_FILE');
    }
} catch (e) {
    console.log('ERR:', e.message);
}
