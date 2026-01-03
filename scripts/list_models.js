import fs from 'fs';
import path from 'path';

// Manual env parsing
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent.split('\n').reduce((acc, line) => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();
            value = value.replace(/^["']|["']$/g, '');
            acc[key] = value;
        }
        return acc;
    }, {});

    const apiKey = envVars.VITE_GEMINI_KEY || envVars.VITE_GOOGLE_API_KEY;

    if (!apiKey) {
        console.error("No API key found in .env");
        process.exit(1);
    }

    console.log(`Using Key: ...${apiKey.substring(apiKey.length - 4)}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log("Fetching models from:", url);
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.models) {
        console.log("Available Models:");
        data.models.forEach(m => {
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                console.log(` - ${m.name} (${m.displayName})`);
            }
        });
    } else {
        console.log("Response:", JSON.stringify(data, null, 2));
    }

} catch (e) {
    console.error("Error:", e.message);
}
