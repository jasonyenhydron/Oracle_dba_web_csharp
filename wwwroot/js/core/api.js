/**
 * core/api.js — API 層
 * 封裝所有與後端的 HTTP/streaming 通訊
 */

const API = {
    /**
     * GET 請求
     * @param {string} url
     * @param {Object} [params] - query params
     * @returns {Promise<Response>}
     */
    get(url, params = {}) {
        const qs = Object.keys(params).length
            ? '?' + new URLSearchParams(params).toString()
            : '';
        return fetch(url + qs);
    },

    /**
     * POST JSON 請求
     * @param {string} url
     * @param {Object} body
     * @returns {Promise<Response>}
     */
    post(url, body = {}) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    /**
     * DELETE 請求
     * @param {string} url
     * @returns {Promise<Response>}
     */
    delete(url) {
        return fetch(url, { method: 'DELETE' });
    },

    /**
     * POST Form 請求 (application/x-www-form-urlencoded)
     * @param {string} url
     * @param {Object} formData
     * @returns {Promise<Response>}
     */
    postForm(url, formData = {}) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        });
    },

    /**
     * NDJSON streaming 請求
     * 每次有完整的 JSON 行時呼叫 onChunk callback
     * @param {string} url
     * @param {Object} body
     * @param {Function} onChunk  - (parsedJson) => void
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    async stream(url, body, onChunk, signal) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留未完成行

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    onChunk(JSON.parse(trimmed));
                } catch (e) {
                    console.warn('Failed to parse NDJSON line:', trimmed, e);
                }
            }
        }

        // 處理最後一行
        if (buffer.trim()) {
            try { onChunk(JSON.parse(buffer.trim())); } catch (_) {}
        }
    }
};

// 讓全域可用
window.API = API;
