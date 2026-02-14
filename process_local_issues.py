#!/usr/bin/env python3
"""Process local JSON issue files into trove.jsonl (offline, no GitHub API calls)."""

import argparse
import json
from pathlib import Path

from process_issues import process_issue_list


def main():
    parser = argparse.ArgumentParser(description="Process local issue files")
    parser.add_argument("--issues-dir", required=True,
                        help="Directory containing .json issue files")
    parser.add_argument("--output", required=True,
                        help="Path for output trove.jsonl")
    args = parser.parse_args()

    issues_dir = Path(args.issues_dir)
    output = Path(args.output)

    issues = []
    for f in sorted(issues_dir.glob("*.json")):
        issues.append(json.loads(f.read_text()))

    process_issue_list(issues, trove_path=output, local=True)


if __name__ == "__main__":
    main()
