
// Remove require since we are embedding the function for testing
// const { extractAndNormalizeUrl } = require('./frontend/src/lib/url-utils'); 

// Copying the function logic for quick node test since we can't easily import TS in node script without setup
function testExtract(text) {
    if (!text || typeof text !== 'string') return null;
    const candidate = text.trim().replace(/^["']|["']$/g, '');
    
    const ytIdMatch = candidate.match(/^([a-zA-Z0-9_-]{11})$/);
    if (ytIdMatch) return `https://www.youtube.com/watch?v=${ytIdMatch[1]}`;

    // Regex from the file
    const urlRegex = /(?:(?:https?:\/\/)|(?:www\.)|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/)[^\s<>"')\]]+/g;
    
    const matches = candidate.match(urlRegex);
    if (!matches) return null;

    let rawUrl = matches[0];
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        rawUrl = `https://${rawUrl}`;
    }

    try {
        const urlObj = new URL(rawUrl);
        if (!urlObj.hostname.includes('.')) return null;
        return urlObj.toString();
    } catch (e) {
        return null;
    }
}

const input = "bilibili.com/video/BV1vizZBHEhS/?spm_id_from=333.1007.tianma.1-3-3.click";
console.log(`Input: ${input}`);
console.log(`Output: ${testExtract(input)}`);
