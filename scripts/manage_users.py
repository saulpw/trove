#!/usr/bin/env python3
"""Manage users in the TROVE_USERS Netlify environment variable."""

import argparse
import getpass
import json
from pathlib import Path
import subprocess
import sys
import warnings


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class UserError(Exception):
    pass


def netlify_json(*args):
    try:
        result = subprocess.run(
            ["netlify", *args, "--json"], cwd=PROJECT_ROOT,
            capture_output=True, text=True,
        )
    except FileNotFoundError:
        raise UserError("Netlify CLI not found. Run make setup first.") from None
    if result.returncode:
        raise UserError(
            f"Netlify {args[0]} failed (exit {result.returncode}). "
            "Check Netlify login, project linkage, and permissions."
        )
    try:
        data = json.loads(result.stdout)
    except ValueError:
        raise UserError(
            f"Netlify {args[0]} returned an invalid response. "
            "Run netlify link from the project folder and check Netlify login."
        ) from None
    if not isinstance(data, dict):
        raise UserError(f"Netlify {args[0]} returned an invalid response.")
    return data


def validate_user(username, password):
    if (not username or username != username.strip()
            or not username.isprintable() or any(c in username for c in ":,")):
        raise UserError("Username must be nonempty, trimmed, and contain no colon, comma, or control characters.")
    if (not password or password != password.strip()
            or not password.isprintable() or "," in password):
        raise UserError("Password must be nonempty, trimmed, and contain no comma or control characters.")


def get_users():
    data = netlify_json("env:get", "TROVE_USERS", "--context", "production", "--scope", "functions")
    raw = data.get("TROVE_USERS", "")
    if not isinstance(raw, str) or set(data) - {"TROVE_USERS"}:
        raise UserError("Invalid TROVE_USERS response; refusing to modify users.")
    if not raw:
        return {}
    users = {}
    for entry in raw.split(","):
        username, separator, password = entry.partition(":")
        if not separator or username in users:
            raise UserError("Malformed or duplicate TROVE_USERS entry; refusing to modify users.")
        validate_user(username, password)
        users[username] = password
    return users


def set_users(users):
    if not users:
        raise UserError("Netlify env:set cannot reliably clear the last user. Clear the production TROVE_USERS value in the Netlify dashboard, then redeploy.")
    value = ",".join(f"{u}:{p}" for u, p in users.items())
    netlify_json("env:set", "TROVE_USERS", value, "--context", "production", "--force")
    try:
        saved = get_users()
    except UserError:
        raise UserError("TROVE_USERS verification failed. The write may have occurred; inspect Netlify before retrying.") from None
    if saved != users:
        raise UserError("TROVE_USERS read-back did not match. The write may have occurred; inspect Netlify before retrying.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="action", required=True)
    add = actions.add_parser("add")
    add.add_argument("username")
    remove = actions.add_parser("remove")
    remove.add_argument("username")
    actions.add_parser("list")
    args = parser.parse_args()
    try:
        status = netlify_json("status")
        site = status.get("siteData")
        if not isinstance(site, dict) or not site.get("site-id"):
            raise UserError("No linked Netlify project. Run netlify link from the project folder.")
        users = get_users()
        if args.action == "list":
            print("\n".join(sorted(users)) if users else "No users configured.")
            return 0
        if args.action == "add":
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                password = getpass.getpass("Password: ")
            validate_user(args.username, password)
            users[args.username] = password
        else:
            if args.username not in users:
                raise UserError(f"User not found: {args.username}")
            del users[args.username]
        set_users(users)
        print(f"{'Added' if args.action == 'add' else 'Removed'} user: {args.username}")
        print("Verified production TROVE_USERS. Redeploy to activate (netlify deploy --prod --build, or push to main).")
        return 0
    except (UserError, EOFError, getpass.GetPassWarning) as error:
        print(f"Error: {error or 'Password input requires an interactive terminal.'}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
