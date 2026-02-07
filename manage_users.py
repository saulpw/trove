#!/usr/bin/env python3
"""Manage users in the TROVE_USERS Netlify environment variable.

Usage:
    python3 manage_users.py add <username> <password>
    python3 manage_users.py remove <username>
    python3 manage_users.py list
"""

import subprocess
import sys


def get_users():
    """Fetch current TROVE_USERS from Netlify and parse into dict."""
    result = subprocess.run(
        ["netlify", "env:get", "TROVE_USERS"],
        capture_output=True, text=True
    )
    raw = result.stdout.strip()
    if not raw:
        return {}
    users = {}
    for entry in raw.split(","):
        parts = entry.split(":", 1)
        if len(parts) == 2:
            users[parts[0].strip()] = parts[1].strip()
    return users


def set_users(users):
    """Write users dict back to Netlify TROVE_USERS env var."""
    value = ",".join(f"{u}:{p}" for u, p in users.items())
    subprocess.run(
        ["netlify", "env:set", "TROVE_USERS", value],
        check=True
    )


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1]

    if action == "list":
        users = get_users()
        if not users:
            print("No users configured.")
        else:
            for username in sorted(users):
                print(f"  {username}")

    elif action == "add":
        if len(sys.argv) != 4:
            print("Usage: python3 manage_users.py add <username> <password>")
            sys.exit(1)
        username, password = sys.argv[2], sys.argv[3]
        users = get_users()
        users[username] = password
        set_users(users)
        print(f"Added user: {username}")

    elif action == "remove":
        if len(sys.argv) != 3:
            print("Usage: python3 manage_users.py remove <username>")
            sys.exit(1)
        username = sys.argv[2]
        users = get_users()
        if username not in users:
            print(f"User not found: {username}")
            sys.exit(1)
        del users[username]
        set_users(users)
        print(f"Removed user: {username}")

    else:
        print(f"Unknown action: {action}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
