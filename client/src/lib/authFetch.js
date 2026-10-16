import axios from 'axios';
import { API_URL } from '../config';

const TOKEN_KEY = 'token';

// Broadcast a session-expired signal so AuthContext can sign the user out and
// explain why (e.g. the server rejected an idle token).
function emitSessionExpired() {
    try {
        window.dispatchEvent(new CustomEvent('pem:session-expired'));
    } catch { /* ignore */ }
}

// Attach the stored bearer token to every same-origin API request automatically.
// This guarantees authenticated calls even for components that omit headers,
// while never overwriting an Authorization header a caller set explicitly.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function authFetch(input, init) {
        let token = null;
        let isApiRequest = false;
        let finalInput = input;
        let finalInit = init;

        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            token = window.localStorage ? window.localStorage.getItem(TOKEN_KEY) : null;
            isApiRequest = !!token && API_URL && url.startsWith(API_URL);

            if (isApiRequest) {
                if (typeof input === 'string') {
                    const headers = new Headers((finalInit && finalInit.headers) || {});
                    if (!headers.has('Authorization')) {
                        headers.set('Authorization', `Bearer ${token}`);
                    }
                    finalInit = { ...(finalInit || {}), headers };
                } else if (typeof Request !== 'undefined' && input instanceof Request) {
                    const headers = new Headers(input.headers || {});
                    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
                    finalInput = new Request(input, { headers });
                }
            }
        } catch {
            // Never block a request because of the auth shim; fall through.
        }

        const response = await originalFetch(finalInput, finalInit);

        // Surface a server-side idle rejection so the app can sign the user out.
        if (isApiRequest && response && response.status === 401) {
            try {
                const data = await response.clone().json();
                if (data && data.code === 'SESSION_IDLE_TIMEOUT') emitSessionExpired();
            } catch {
                // Non-JSON body (or already consumed) - nothing to do.
            }
        }

        return response;
    };
}

// Attach the stored bearer token to axios requests as well.
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
        } catch {
            // Never block a request because of the auth shim; fall through.
        }
        return config;
    });
}

// React to an idle/expired session reported by the server on axios requests.
if (axios && axios.interceptors && axios.interceptors.response) {
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            try {
                if (error?.response?.status === 401 && error?.response?.data?.code === 'SESSION_IDLE_TIMEOUT') {
                    emitSessionExpired();
                }
            } catch {
                // ignore
            }
            return Promise.reject(error);
        }
    );
}

export default null;
