/**
 * Tencent Cloud ASR Implementation
 * 腾讯云语音识别
 */

const config = require('../../config');
const axios = require('axios');
const Crypto = require('crypto');

const { secretId, secretKey, region, appId } = config.tencent;
const { engineType, projectId, subServiceType, convServiceType } = config.tencent.asr;

/**
 * Tencent ASR - Speech to Text
 */
async function tencentASR(audioBuffer) {
    const logger = global.logger;
    
    if (!secretId || !secretKey) {
        logger.warn('⚠️ Tencent credentials not configured');
        throw new Error('Tencent ASR not configured');
    }
    
    // Build request
    const endpoint = 'asr.tencentcloudapi.com';
    const action = 'CreateRecTask';
    const version = '2019-06-14';
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 10000);
    
    // Signature
    const signature = await generateSignature({
        secretId,
        secretKey,
        region,
        endpoint,
        action,
        version,
        timestamp,
        nonce,
        engineType,
        projectId,
        subServiceType,
        convServiceType,
        audioBuffer
    });
    
    // API call
    const url = `https://${endpoint}`;
    const params = {
        Action: action,
        Version: version,
        Signature: signature,
        SecretId: secretId,
        Timestamp: timestamp,
        Nonce: nonce,
        Region: region,
        ProjectId: projectId,
        SubServiceType: subServiceType,
        ConvServiceType: convServiceType,
        EngineType: engineType,
        VoiceFormat: 1,  // PCM
        Url: '',  // Empty = audio data
        Data: audioBuffer.toString('base64'),
        DataLen: audioBuffer.length
    };
    
    const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
    });
    
    const result = response.data;
    
    if (result.Response && result.Response.TaskId) {
        // Async recognition - wait for result
        const taskId = result.Response.TaskId;
        return await waitForResult(taskId);
    }
    
    if (result.Response && result.Response.Text) {
        return result.Response.Text;
    }
    
    if (result.Response && result.Response.ResultList) {
        for (const item of result.Response.ResultList) {
            if (item.Text) return item.Text;
        }
    }
    
    throw new Error('ASR result empty');
}

/**
 * Wait for async ASR result
 */
async function waitForResult(taskId, maxWait = 5000) {
    const startTime = Date.now();
    const endpoint = 'asr.tencentcloudapi.com';
    const { secretId, secretKey, region } = config.tencent;
    
    while (Date.now() - startTime < maxWait) {
        await new Promise(r => setTimeout(r, 500));
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = Math.floor(Math.random() * 10000);
        
        const signature = await generateSignature({
            secretId,
            secretKey,
            region,
            endpoint,
            action: 'DescribeTaskStatus',
            version: '2019-06-14',
            timestamp,
            nonce,
            taskId
        });
        
        const url = `https://${endpoint}`;
        const params = {
            Action: 'DescribeTaskStatus',
            Version: '2019-06-14',
            Signature: signature,
            SecretId: secretId,
            Timestamp: timestamp,
            Nonce: nonce,
            Region: region,
            TaskId: taskId
        };
        
        const response = await axios.post(url, params, { timeout: 5000 });
        const result = response.data;
        
        if (result.Response && result.Response.Status === 0) {
            if (result.Response.ResultList && result.Response.ResultList[0]) {
                return result.Response.ResultList[0].Text;
            }
        }
        
        if (result.Response && result.Response.Status === 1) {
            // Still processing
            continue;
        }
        
        if (result.Response && result.Response.Status === 2) {
            throw new Error('ASR task failed: ' + (result.Response.Message || 'unknown'));
        }
    }
    
    throw new Error('ASR timeout');
}

/**
 * Generate Tencent API signature
 */
async function generateSignature(params) {
    const { secretId, secretKey, region, endpoint, action, version, timestamp, nonce, ...extra } = params;
    
    // Build canonical request
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
    
    // HmacSHA256
    const crypto = require('crypto');
    const signKey = crypto.createHmac('sha256', secretKey).update(secretId).digest();
    const signature = crypto.createHmac('sha256', signKey).update(canonicalRequest).digest('base64');
    
    return signature;
}

module.exports = { tencentASR };