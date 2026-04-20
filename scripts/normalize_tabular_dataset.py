#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> None:
    script = Path(__file__).with_name("normalize_dataset.py")
    subprocess.run([sys.executable, str(script), "--mode", "tabular", *sys.argv[1:]], check=True)


if __name__ == "__main__":
    main()

