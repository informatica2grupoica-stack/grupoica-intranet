"""
Script Python que:
1. Inicia cloudflared con el tunnel nombrado (token en vercel-config.txt)
2. Captura la URL publica automaticamente
3. Llama a la API de Vercel para actualizar PYTHON_BACKEND_URL
4. Hace redeploy automatico
"""
import subprocess
import re
import os
import sys

try:
    import requests
except ImportError:
    os.system("pip install requests -q")
    import requests

# ─── Leer config desde vercel-config.txt (NO se sube a GitHub) ───────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(script_dir, "vercel-config.txt")

config = {}
if os.path.exists(config_path):
    with open(config_path, "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                config[k.strip()] = v.strip()

VERCEL_TOKEN  = config.get("TOKEN", "")
PROJECT_ID    = config.get("PROJECT_ID", "")
ENV_ID        = config.get("ENV_ID", "")
DEPLOY_ID     = config.get("DEPLOY_ID", "")
TUNNEL_TOKEN  = config.get("TUNNEL_TOKEN", "")

if not VERCEL_TOKEN or not PROJECT_ID:
    print("  [!] Falta TOKEN o PROJECT_ID en vercel-config.txt")
    sys.exit(1)

if not TUNNEL_TOKEN:
    print("  [!] Falta TUNNEL_TOKEN en vercel-config.txt")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────

def update_vercel(url):
    headers = {
        "Authorization": f"Bearer {VERCEL_TOKEN}",
        "Content-Type": "application/json",
    }
    r = requests.patch(
        f"https://api.vercel.com/v10/projects/{PROJECT_ID}/env/{ENV_ID}",
        headers=headers,
        json={"value": url},
        timeout=10,
    )
    if r.status_code == 200:
        print(f"  ✅ Vercel actualizado: {url}")
    else:
        print(f"  ⚠️  Vercel error {r.status_code}: {r.text[:100]}")
        return
    if DEPLOY_ID:
        r2 = requests.post(
            "https://api.vercel.com/v13/deployments?forceNew=1",
            headers=headers,
            json={"name": "grupoica-intranet", "deploymentId": DEPLOY_ID, "target": "production"},
            timeout=10,
        )
        dep_url = r2.json().get("url", "") if r2.status_code in (200, 201) else ""
        print(f"  ✅ Redeploy: {dep_url or r2.status_code}")


def main():
    print()
    print("  ════════════════════════════════════════════")
    print("  🚇 Iniciando Cloudflare Tunnel (permanente)")
    print("  ════════════════════════════════════════════")

    parent_dir = os.path.dirname(script_dir)
    cloudflared = os.path.join(parent_dir, "cloudflared.exe")
    if not os.path.exists(cloudflared):
        cloudflared = "cloudflared"

    cmd = [cloudflared, "tunnel", "--no-autoupdate", "run", "--token", TUNNEL_TOKEN]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
    )

    url_encontrada = False
    print("  [*] Esperando conexion del tunnel...")

    for line in proc.stdout:
        line = line.rstrip()
        if line:
            print(f"  {line}")
        if not url_encontrada:
            m = re.search(r'https://[a-z0-9\-]+\.(trycloudflare|cfargotunnel)\.com', line)
            if m:
                tunnel_url = m.group(0)
                print()
                print(f"  ✅ Tunnel activo: {tunnel_url}")
                print(f"  📡 Actualizando Vercel automaticamente...")
                try:
                    update_vercel(tunnel_url)
                except Exception as e:
                    print(f"  ⚠️  Error Vercel: {e}")
                print()
                print("  ════════════════════════════════════════════")
                print("  Servidor activo. NO cierres esta ventana.")
                print("  ════════════════════════════════════════════")
                url_encontrada = True

    proc.wait()


if __name__ == "__main__":
    main()
