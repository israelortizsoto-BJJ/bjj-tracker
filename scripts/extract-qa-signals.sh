#!/bin/bash

LOG_FILE=$1
OUT_DIR="logs/extracted"

mkdir -p "$OUT_DIR"

echo "Extracting QA signals from $LOG_FILE"

grep -n "SUMMARY" "$LOG_FILE" > "$OUT_DIR/summary.log"
grep -n "SYSTEM" "$LOG_FILE" > "$OUT_DIR/system.log"
grep -n "ALIGNMENT" "$LOG_FILE" > "$OUT_DIR/alignment.log"
grep -n "PROGRESSION" "$LOG_FILE" > "$OUT_DIR/progression.log"
grep -n "WEEKLY" "$LOG_FILE" > "$OUT_DIR/weekly.log"
grep -n "ERROR" "$LOG_FILE" > "$OUT_DIR/errors.log"
grep -n "WARN" "$LOG_FILE" > "$OUT_DIR/warnings.log"

echo ""
echo "Done."
echo "Artifacts saved to:"
echo "$OUT_DIR"
