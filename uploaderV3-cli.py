#!/usr/bin/env python3

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = "https://dataportal.aiscorp.com/api"

def request(method, path, token=None, data=None):
    url = f"{BASE_URL}{path}"

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    if data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode()

    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode()

            if not body:
                return

            try:
                print(json.dumps(json.loads(body), indent=2))
            except json.JSONDecodeError:
                print(body)

    except urllib.error.HTTPError as e:
        body = e.read().decode()

        print(f"HTTP {e.code}: {e.reason}", file=sys.stderr)

        if body:
            try:
                print(json.dumps(json.loads(body), indent=2), file=sys.stderr)
            except json.JSONDecodeError:
                print(body, file=sys.stderr)

        sys.exit(1)

    except urllib.error.URLError as e:
        print(f"Request failed: {e.reason}", file=sys.stderr)
        sys.exit(1)


def token():
    value = os.getenv("ACCESS_TOKEN")
    if not value:
        print("Set the ACCESS_TOKEN environment variable.", file=sys.stderr,)
        sys.exit(1)
    return value


def main():
    parser = argparse.ArgumentParser(description="UploaderV3's CLI")

    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("health")

    create = sub.add_parser("create-link")
    create.add_argument("case_id")
    create.add_argument(
        "--region",
        choices=["US", "EU"],
        default="US",
    )

    sub.add_parser("links")

    link = sub.add_parser("link")
    link.add_argument("uuid")

    files = sub.add_parser("files")
    files.add_argument("uuid")

    extend = sub.add_parser("extend")
    extend.add_argument("upload_id")
    extend.add_argument("days", type=int)

    delete = sub.add_parser("delete")
    delete.add_argument("upload_id")

    delete_all = sub.add_parser("delete-all")
    delete_all.add_argument("uuid")

    request_delete = sub.add_parser("request-deletion")
    request_delete.add_argument("uuid")

    args = parser.parse_args()

    if args.command == "health":
        request("GET", "/health")
        return

    auth_token = token()

    if args.command == "create-link":
        request(
            "POST",
            "/links/create/",
            auth_token,
            {
                "case_id": args.case_id,
                "storage_region": args.region,
            },
        )

    elif args.command == "links":
        request("GET", "/links/", auth_token)

    elif args.command == "link":
        request("GET", f"/links/{args.uuid}", auth_token)

    elif args.command == "files":
        request("GET", f"/links/{args.uuid}/files", auth_token)

    elif args.command == "extend":
        request(
            "POST",
            f"/uploads/{args.upload_id}/extend_expiration"
            f"?additional_days={args.days}",
            auth_token,
        )

    elif args.command == "delete":
        request(
            "POST",
            f"/uploads/{args.upload_id}/mark_for_deletion",
            auth_token,
        )

    elif args.command == "delete-all":
        request(
            "POST",
            f"/links/{args.uuid}/mark_all_for_deletion",
            auth_token,
        )

    elif args.command == "request-deletion":
        request(
            "POST",
            f"/requestfordeletion/{args.uuid}",
            auth_token,
        )


if __name__ == "__main__":
    main()
