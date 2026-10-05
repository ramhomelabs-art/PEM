module.exports = {
    apps: [
        {
            name: "pem-backend",
            script: "index.js",
            cwd: "./server",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            exp_backoff_restart_delay: 100,
            log_date_format: 'YYYY-MM-DD HH:mm Z',
            env: {
                NODE_ENV: "development",
                PORT: 5001
            }
        },
        {
            name: "pem-python",
            script: "app.py",
            cwd: "./python-extraction-service",
            interpreter: "D:\\PEM\\var\\www\\finance-project\\python-extraction-service\\venv_win\\Scripts\\python.exe",
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            exp_backoff_restart_delay: 100,
            log_date_format: 'YYYY-MM-DD HH:mm Z'
        },
        {
            name: "pem-sms-parser",
            script: "sms-parser-service.js",
            cwd: "./server",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                PORT: 5003
            }
        }
    ]
};
