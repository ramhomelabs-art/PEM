import axios from 'axios';
import { API_URL } from '../config';

const TOKEN_KEY = 'token';

// Attach the stored bearer token to every same-origin API request automatically.
// This guarantees authenticated calls even for components that omit headers,
// while never overwriting an Authorization header a caller set explicitly.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);

    window.fetch = function authFetch(input, init) {
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const token = window.localStorage ? window.localStorage.getItem(TOKEN_KEY) : null;
            const isApiRequest = !!token && API_URL && url.startsWith(API_URL);

            if (isApiRequest) {
                if (typeof input === 'string') {
                    const headers = new Headers((init && init.headers) || undefined);
                    if (!headers.has('Authorization')) {
                        headers.set('Authorization', `Bearer ${token}`);
                    }
                    return originalFetch(input, { ...(init || {}), headers });
                }
                if (typeof Request !== 'undefined' && input instanceof Request) {
                    const headers = new Headers(input.headers);
                    if (!headers.has('Authorization')) {
                        headers.set('Authorization', `Bearer ${token}`);
                    }
                    return originalFetch(new Request(input, { headers }), init);
                }
            }
        } catch (e) {
            // Never block a request because of the auth shim; fall through.
        }
        return originalFetch(input, init);
    };
}

// Attach the stored bearer token to axios requests as well. axios does not route
// through window.fetch, so components that call axios without explicit headers
// would otherwise hit protected endpoints with no Authorization header (HTTP 401).
if (axios && axios.interceptors && axios.interceptors.request) {
    axios.interceptors.request.use((config) => {
        try {
            const token = typeof window !== 'undefined' && window.localStorage
                ? window.localStorage.getItem(TOKEN_KEY)
                : null;
            const url = (config && config.url) || '';
            const isApiRequest = !!token && API_URL && url.startsWith(API_URL);

            if (isApiRequest) {
                if (config.headers && typeof config.headers.set === 'function') {
                    if (!config.headers.has('Authorization')) {
                        config.headers.set('Authorization', `Bearer ${token}`);
                    }
                } else {
                    config.headers = config.headers || {};
                    if (!config.headers.Authorization && !config.headers.authorization) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                }
            }
        } catch (e) {
            // Never block a request because of the auth shim; fall through.
        }
        return config;
    });
}

export default null;
