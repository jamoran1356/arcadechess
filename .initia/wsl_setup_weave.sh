#!/usr/bin/env bash
set -euo pipefail

export PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

mkdir -p /root/.local/bin /root/.weave

cat > /root/.weave/config.json <<'JSON'
{
  "common": {
    "analytics_device_id": "3aa5ab2a-96ed-44df-831a-f4540d07cc35",
    "analytics_opt_out": false,
    "gas_station": {
      "initia_address": "init1hepzz6uxjfvjggjdueq003n9tg0tc8f3nuztj5",
      "celestia_address": "",
      "mnemonic": "logic reduce now style bracket buzz zebra copy clutch exchange exclude kiwi lady apple subject bacon puppy duty stomach sock direct apple trouble tomato",
      "coin_type": 60
    }
  }
}
JSON

cat > /root/.local/bin/lz4 <<'SH'
#!/usr/bin/env bash
echo "lz4 shim (placeholder)" >&2
exit 1
SH
chmod +x /root/.local/bin/lz4

if [ ! -x /root/.local/bin/weave ]; then
  cd /tmp
  curl -L -o weave.tar.gz https://github.com/initia-labs/weave/releases/download/v0.3.8/weave-0.3.8-linux-amd64.tar.gz
  tar -xzf weave.tar.gz
  install -m 0755 weave /root/.local/bin/weave
fi

/root/.local/bin/weave version
command -v lz4
