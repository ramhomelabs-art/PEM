# SMS Parser Retraining Automation Script
# Run this from the project root: .\python-extraction-service\ml_training\retrain.ps1

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting SMS Parser Retraining Pipeline" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Stop the AI Service to free up model files
Write-Host "[1/4] Stopping AI Service..." -ForegroundColor Yellow
$aiProcess = Get-NetTCPConnection -LocalPort 5002 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Select-Object -First 1
if ($aiProcess) {
    Stop-Process -Id $aiProcess -Force
    Write-Host "✅ AI Service stopped." -ForegroundColor Green
} else {
    Write-Host "ℹ️ AI Service not running."
}

# 2. Regenerate Training Data
Write-Host "[2/4] Regenerating synthetic data from seed samples..." -ForegroundColor Yellow
cd python-extraction-service\ml_training
python prepare_data.py
if ($LASTEXITCODE -ne 0) { Write-Error "Data Preparation Failed!"; exit }

# 3. Train the Model
Write-Host "[3/4] Training BERT model (Round 7+)..." -ForegroundColor Yellow
Write-Host "⏱️ This will take ~15 minutes on CPU. Please wait..."
python train_model.py --epochs 3
if ($LASTEXITCODE -ne 0) { Write-Error "Training Failed!"; exit }

# 4. Restart AI Service
Write-Host "[4/4] Restarting AI Service with new model..." -ForegroundColor Yellow
cd ..
Start-Process python -ArgumentList "app.py" -NoNewWindow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ Retraining complete and service is LIVE!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
