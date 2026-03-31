#!/usr/bin/env bash
set -euo pipefail

export PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /mnt/c/wamp/www/proyectos/playchess

/root/.local/bin/weave rollup launch --with-config .initia/minitia.config.json --vm move --force
