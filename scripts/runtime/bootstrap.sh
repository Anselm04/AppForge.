#!/bin/sh
# Root-only startup preparation; the web server and every workload run as 1001.
set -eu
unset APPFORGE_SANDBOX_PREPARED
if [ "${EXISTING_HOST_SANDBOX_ENABLED:-false}" = "true" ]; then
  prepared=true
  if ! node /app/scripts/runtime/namespace-filter.mjs /app/scripts/runtime/namespace-seccomp.bpf; then prepared=false; fi
  workspace=/var/lib/appforge-builds
  mkdir -p "$workspace"
  if ! mount -t tmpfs -o size=512m,nosuid,nodev,mode=0700 tmpfs "$workspace"; then
    prepared=false
  fi
  if [ "$prepared" = true ]; then
    chown 1001:1001 "$workspace"
    for controller in memory cpu,cpuacct pids; do
      group="/sys/fs/cgroup/$controller/appforge-builds"
      if ! mkdir -p "$group"; then prepared=false; break; fi
      case "$controller" in
        memory)
          if ! { echo 1 > "$group/memory.use_hierarchy" && echo 805306368 > "$group/memory.limit_in_bytes"; }; then prepared=false; break; fi
          if [ -f "$group/memory.memsw.limit_in_bytes" ]; then
            if ! echo 805306368 > "$group/memory.memsw.limit_in_bytes"; then prepared=false; break; fi
          fi ;;
        cpu,cpuacct)
          if ! { echo 100000 > "$group/cpu.cfs_period_us" && echo 50000 > "$group/cpu.cfs_quota_us"; }; then prepared=false; break; fi ;;
        pids)
          if ! echo 256 > "$group/pids.max"; then prepared=false; break; fi ;;
      esac
      # The immutable aggregate limits stay root-owned. Only child creation
      # and membership are delegated; generated code never sees cgroup mounts.
      chown 1001:1001 "$group" "$group/cgroup.procs"
    done
  fi
  if [ "$prepared" = true ]; then
    export APPFORGE_SANDBOX_PREPARED=true
  else
    echo "Existing-host build isolation is unavailable; build execution stays disabled." >&2
  fi
fi
exec su-exec 1001:1001 "$@"
