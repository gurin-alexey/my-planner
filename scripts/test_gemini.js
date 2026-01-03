import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Manual env parsing
try {
    const envPath = path.resolve(process.cwd(), '.env');
    console.log("Reading .env from:", envPath);
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent.split('\n').reduce((acc, line) => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            // Join back in case value has =
            let value = parts.slice(1).join('=').trim();
            // Strip quotes
            value = value.replace(/^["']|["']$/g, '');
            acc[key] = value;
        }
        return acc;
    }, {});

    const apiKey = envVars.VITE_GEMINI_KEY || envVars.VITE_GOOGLE_API_KEY;

    if (!apiKey) {
        console.error("❌ No API key found in .env (looked for VITE_GEMINI_KEY or VITE_GOOGLE_API_KEY)");
        process.exit(1);
    }

    console.log(`🔑 Key found: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    // List models first
    /*
    // Not strictly necessary to list every time, but good for debug if needed.
    // const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    // ... listing requires ModelManager ...
    */

    console.log("📡 sending request to Gemini (gemini-1.5-flash)...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Hello?");
    const response = await result.response;
    console.log("✅ Success! Response:", response.text());

} catch (e) {
    console.error("❌ Error:", e.message);
    if (e.message.includes("API key")) console.error("   -> Check your API key validity.");
    if (e.response) {
        console.error("   -> Details:", JSON.stringify(e.response, null, 2));
    }
}
