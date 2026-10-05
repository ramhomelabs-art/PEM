const hostname = window.location.hostname;
const port = window.location.port;

const API_PORT = import.meta.env.VITE_API_PORT || '5005';
const API_HOST = import.meta.env.VITE_API_HOST || hostname;

let API_URL;
let BASE_URL;

if (import.meta.env.DEV || port === '5174' || port === '5173') {
    API_URL = `http://${API_HOST}:${API_PORT}/api`;
    BASE_URL = `http://${API_HOST}:${API_PORT}`;
} else {
    API_URL = '/api';
    BASE_URL = '';
}

export { API_URL, BASE_URL };
