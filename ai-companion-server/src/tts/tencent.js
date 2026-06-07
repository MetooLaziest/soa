/**
 * Tencent Cloud TTS Implementation
 * 腾讯云语音合成
 */

const config = require('../../config');
const axios = require('axios');
const crypto = require('crypto');

const { secretId, secretKey, region, appId } = config.tencent;
const { voiceType, speed, volume, pitch, codec } = config.tencent.tts;

/**
 * Tencent TTS - Text to Speech
 */
async function tencentTTS(text) {
    const logger = global.logger;
    
    if (!secretId || !secretKey) {
        logger.warn('⚠️ Tencent credentials not configured');
        throw new Error('Tencent TTS not configured');
    }
    
    const endpoint = 'tts.tencentcloudapi.com';
    const action = 'TextToVoice';
    const version = '2019-08-23';
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 10000);
    
    const signature = await generateSignature({
        secretId,
        secretKey,
        region,
        endpoint,
        action,
        version,
        timestamp,
        nonce,
        text,
        voiceType,
        speed,
        volume,
        pitch,
        codec
    });
    
    const url = `https://${endpoint}`;
    const params = {
        Action: action,
        Version: version,
        Signature: signature,
        SecretId: secretId,
        Timestamp: timestamp,
        Nonce: nonce,
        Region: region,
        Text: text,
        VoiceType: voiceType,
        Speed: speed,
        Volume: volume,
        Pitch: pitch,
        Codec: codec
    };
    
    const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
    });
    
    const result = response.data;
    
    if (result.Response && result.Response.Audio) {
        return Buffer.from(result.Response.Audio, 'base64');
    }
    
    if (result.Response && result.Response.Data) {
        return Buffer.from(result.Response.Data, 'base64');
    }
    
    throw new Error('TTS result empty: ' + JSON.stringify(result));
}

async function generateSignature(params) {
    const { secretId, secretKey, region, endpoint, action, version, timestamp, nonce, ...extra } = params;
    
    const paramsList = [
        `Action=${action}`,
        `Nonce=${nonce}`,
        `Region=${region}`,
        `SecretId=${secretId}`,
        `Timestamp=${timestamp}`,
        `Version=${version}`
    ];
    
    for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined && value !== '') {
            paramsList.push(`${key}=${value}`);
        }
    }
    
    paramsList.sort();
    const canonicalParams = paramsList.join('&');
    const canonicalRequest = `POST${endpoint}/?${canonicalParams}`;
    
    const signKey = crypto.createHmac('sha256', secretKey).update(secretId).digest();
    const signature = crypto.createHmac('sha256', signKey).update(canonicalRequest).digest('base64');
    
    return signature;
}

module.exports = { tencentTTS };
