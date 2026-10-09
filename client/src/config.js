const hostname = window.location.hostname;

// Using relative '/api' leverages Vite dev proxy (port 5174) or Nginx reverse proxy,
// preventing CORS and Windows Firewall blocks when accessing via LAN IP.
let API_URL = '/api';
let BASE_URL = '';

// If accessing directly from localhost dev server, allow direct or proxy
if (import.meta.env.DEV && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    API_URL = '/api';
    BASE_URL = '';
} else {
    API_URL = '/api';
    BASE_URL = '';
}

export { API_URL, BASE_URL };
