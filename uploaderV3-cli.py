#!/usr/bin/env python3

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = "https://dataportal.aiscorp.com/api"
DEFAULT_TIMEOUT = 30


def request(
    method,
    path,
    token=None,
    data=None,
    timeout=DEFAULT_TIMEOUT,
    json_output=False,
    human_output=True,
):
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
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode()

            if not body:
                if human_output:
                    print("Request completed successfully.")
                return None

            try:
                result = json.loads(body)

                if json_output:
                    print(json.dumps(result, indent=2))
                elif human_output:
                    print_human_output(result)

                return result

            except json.JSONDecodeError:
                print(body)
                return body

    except urllib.error.HTTPError as e:
        body = e.read().decode()

        print(f"HTTP {e.code}: {e.reason}", file=sys.stderr)

        if e.code == 401:
            print(
                "The `ACCESS_TOKEN` is missing, expired, invalid, or no longer usable.",
                file=sys.stderr,
            )
        elif e.code == 403:
            print(
                "The authenticated user does not have permission to perform this operation.",
                file=sys.stderr,
            )
        elif e.code == 404:
            print(
                "The requested link, file, or case could not be found.",
                file=sys.stderr,
            )
        elif e.code == 410:
            print(
                "The requested resource has expired.",
                file=sys.stderr,
            )
        elif e.code == 422:
            print(
                "The request parameters failed validation.",
                file=sys.stderr,
            )
        elif e.code == 400:
            print(
                "The request contains invalid data.",
                file=sys.stderr,
            )

        if body:
            try:
                result = json.loads(body)

                if json_output:
                    print(json.dumps(result, indent=2), file=sys.stderr)
                else:
                    print_error_details(result)

            except json.JSONDecodeError:
                print(body, file=sys.stderr)

        sys.exit(1)

    except urllib.error.URLError as e:
        print(f"Request failed: {e.reason}", file=sys.stderr)
        print(
            f"The API could not be reached within `{timeout}` seconds.",
            file=sys.stderr,
        )
        sys.exit(1)

    except TimeoutError:
        print(
            f"Request timed out after `{timeout}` seconds.",
            file=sys.stderr,
        )
        sys.exit(1)


def print_human_output(result):
    if isinstance(result, list):
        if not result:
            print("No results found.")
            return

        if all(
            isinstance(item, dict)
            and "uuid" in item
            and "link" in item
            and "case_id" in item
            for item in result
        ):
            print_links(result)
            return

        for index, item in enumerate(result, 1):
            if index > 1:
                print()
            print_record(item)
        return

    if isinstance(result, dict):
        if "uuid" in result and "link" in result and "case_id" not in result:
            print("Upload link created successfully.")
            print(f"UUID:       {result.get('uuid', 'N/A')}")
            print(f"Upload URL: {result.get('link', 'N/A')}")
            return

        print_record(result)
        return

    print(result)


def print_links(links):
    print(
        f"{'UUID':<36}  "
        f"{'Case ID':<12}  "
        f"{'Customer':<20}  "
        f"{'Status':<24}  "
        f"Expiration"
    )

    print("-" * 120)

    for link in links:
        uuid = str(link.get("uuid", "N/A"))
        case_id = str(link.get("case_id", "N/A"))
        customer = format_value(link.get("customer"))
        status = format_value(link.get("status"))
        expiration = format_expiration(link.get("expiration_date"))

        print(
            f"{uuid:<36}  "
            f"{case_id:<12}  "
            f"{customer[:20]:<20}  "
            f"{status[:24]:<24}  "
            f"{expiration}"
        )

    print()
    print(f"{len(links)} link(s) found.")


def print_record(record):
    if not isinstance(record, dict):
        print(record)
        return

    if "uuid" in record and "link" in record and "case_id" in record:
        print(f"UUID:             {format_value(record.get('uuid'))}")
        print(f"Upload URL:       {format_value(record.get('link'))}")
        print(f"Case ID:          {format_value(record.get('case_id'))}")
        print(f"Customer:         {format_value(record.get('customer'))}")
        print(f"Creator:          {format_value(record.get('creator'))}")
        print(f"Storage region:   {format_value(record.get('storage_region'))}")
        print(f"ITAR:             {format_value(record.get('itar'))}")
        print(f"Status:           {format_value(record.get('status'))}")
        print(f"Expired:          {format_value(record.get('expired'))}")
        print(f"Expiration date:  {format_value(record.get('expiration_date'))}")
        print(f"Created:          {format_value(record.get('timestamp'))}")

        users = record.get("users_with_access")

        if users is not None:
            print("Users with access:")

            for user in users:
                print(f"  {user}")

        return

    if "upload_id" in record and "filename" in record:
        print(f"Upload ID:        {format_value(record.get('upload_id'))}")
        print(f"Filename:         {format_value(record.get('filename'))}")
        print(f"Size:             {format_size(record.get('size'))}")
        print(f"Blob name:        {format_value(record.get('blob_name'))}")

        if "content_type" in record:
            print(f"Content type:     {format_value(record.get('content_type'))}")

        if "expiration_date" in record:
            print(
                f"Expiration date:  "
                f"{format_value(record.get('expiration_date'))}"
            )

        if "upload_complete" in record:
            print(
                f"Upload complete:  "
                f"{format_value(record.get('upload_complete'))}"
            )

        if "date_uploaded" in record:
            print(f"Uploaded:         {format_value(record.get('date_uploaded'))}")

        return

    if "message" in record:
        print(format_value(record.get("message")))

        if "newExpiration" in record:
            print(
                f"New expiration:   "
                f"{format_value(record.get('newExpiration'))}"
            )

        if "newExpirationDate" in record:
            print(
                f"Expiration date:  "
                f"{format_value(record.get('newExpirationDate'))}"
            )

        return

    if "uploadToken" in record:
        print(f"Upload token:     {format_value(record.get('uploadToken'))}")
        print(f"Chunk size:       {format_size(record.get('chunkSize'))}")
        return

    if "received" in record and "offset" in record:
        print(f"Received:         {format_size(record.get('received'))}")
        print(f"Offset:           {format_value(record.get('offset'))}")
        print(f"Hash:             {format_value(record.get('hash'))}")
        return

    if "receivedRanges" in record:
        print(
            f"Received size:    "
            f"{format_size(record.get('receivedSize'))}"
        )
        print(
            f"Expected size:    "
            f"{format_size(record.get('expectedSize'))}"
        )
        print(
            f"Chunk size:       "
            f"{format_size(record.get('chunkSize'))}"
        )
        print(
            f"Chunks received:  "
            f"{format_value(record.get('chunksReceived'))}"
        )
        print(
            f"Completed:        "
            f"{format_value(record.get('completed'))}"
        )
        return

    if "filename" in record and "size" in record and "file_hash" in record:
        print(f"Filename:         {format_value(record.get('filename'))}")
        print(f"Size:             {format_size(record.get('size'))}")
        print(f"File hash:        {format_value(record.get('file_hash'))}")
        print(f"Completed:        {format_value(record.get('completed'))}")
        return

    for key, value in record.items():
        label = key.replace("_", " ").title()
        print(f"{label}: {format_value(value)}")


def print_error_details(result):
    if isinstance(result, dict):
        detail = result.get("detail")

        if detail:
            if isinstance(detail, list):
                for item in detail:
                    if isinstance(item, dict):
                        location = item.get("loc")
                        message = item.get("msg")

                        if location:
                            location_text = ".".join(
                                str(value) for value in location
                            )
                            print(
                                f"Validation error in `{location_text}`: "
                                f"{message}",
                                file=sys.stderr,
                            )
                        else:
                            print(
                                f"Validation error: {message}",
                                file=sys.stderr,
                            )
                    else:
                        print(str(item), file=sys.stderr)
            else:
                print(f"Error: {detail}", file=sys.stderr)

            return

        if "message" in result:
            print(
                f"Error: {result.get('message')}",
                file=sys.stderr,
            )
            return

    print(json.dumps(result, indent=2), file=sys.stderr)


def format_size(value):
    if value is None:
        return "N/A"

    try:
        value = int(value)
    except (TypeError, ValueError):
        return str(value)

    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)

    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(size)} {unit}"
            return f"{size:.2f} {unit}"

        size /= 1024

    return f"{value} B"


def format_value(value):
    if value is None:
        return "N/A"

    if isinstance(value, list):
        if not value:
            return "None"
        return ", ".join(str(item) for item in value)

    if isinstance(value, bool):
        return "Yes" if value else "No"

    return str(value)


def format_expiration(value):
    if value is None:
        return "N/A"

    value = str(value)

    if "T" in value:
        return value.split("T")[0]

    return value


def token():
    value = os.getenv("ACCESS_TOKEN")

    if not value:
        print(
            "Set the `ACCESS_TOKEN` environment variable.",
            file=sys.stderr,
        )
        sys.exit(1)

    return value


def confirm(action):
    response = input(f"{action} [y/N]: ").strip().lower()

    if response not in ("y", "yes"):
        print("Operation cancelled.")
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="UploaderV3's CLI")

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output API responses as JSON",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"Request timeout in seconds (default: {DEFAULT_TIMEOUT})",
    )

    sub = parser.add_subparsers(
        dest="command",
        required=True,
        metavar="COMMAND",
        title="commands",
    )

    sub.add_parser(
        "health",
        aliases=["status"],
        help="Check API availability",
    )

    sub.add_parser(
        "root",
        help="Check API root",
    )

    sub.add_parser(
        "auth-check",
        aliases=["auth"],
        help="Check authentication",
    )

    create = sub.add_parser(
        "create-link",
        aliases=["create"],
        help="Create an upload link",
    )
    create.add_argument("case_id")
    create.add_argument(
        "--region",
        "--storage-region",
        choices=["US", "EU"],
        default="US",
    )

    sub.add_parser(
        "links",
        aliases=["list-links"],
        help="List accessible upload links",
    )

    link = sub.add_parser(
        "link",
        aliases=["get-link"],
        help="Get an upload link",
    )
    link.add_argument("uuid")

    files = sub.add_parser(
        "files",
        aliases=["list-files"],
        help="List files associated with a link",
    )
    files.add_argument("uuid")

    extend = sub.add_parser(
        "extend",
        aliases=["extend-expiration"],
        help="Extend file retention",
    )
    extend.add_argument("upload_id")
    extend.add_argument("days", type=int)
    extend.add_argument("--yes", action="store_true")

    delete = sub.add_parser(
        "delete",
        aliases=["delete-file"],
        help="Mark a file for deletion",
    )
    delete.add_argument("upload_id")
    delete.add_argument("--yes", action="store_true")

    delete_all = sub.add_parser(
        "delete-all",
        aliases=["delete-link-files"],
        help="Mark all files for deletion",
    )
    delete_all.add_argument("uuid")
    delete_all.add_argument("--yes", action="store_true")

    request_delete = sub.add_parser(
        "request-deletion",
        aliases=["request-delete"],
        help="Request data deletion",
    )
    request_delete.add_argument("uuid")

    args = parser.parse_args()

    if args.timeout < 1:
        print("Timeout must be at least 1 second.", file=sys.stderr)
        sys.exit(2)

    if args.command in ("health", "status"):
        request(
            "GET",
            "/health",
            timeout=args.timeout,
            json_output=args.json,
        )
        return

    if args.command == "root":
        request(
            "GET",
            "/",
            timeout=args.timeout,
            json_output=args.json,
        )
        return

    if args.command in ("auth-check", "auth"):
        auth_token = token()

        request(
            "GET",
            "/links/",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
            human_output=False,
        )

        if args.json:
            print(
                json.dumps(
                    {
                        "authenticated": True,
                    },
                    indent=2,
                )
            )
        else:
            print("Authentication successful.")

        return

    if args.command in ("request-deletion", "request-delete"):
        request(
            "POST",
            f"/requestfordeletion/{args.uuid}",
            timeout=args.timeout,
            json_output=args.json,
        )
        return

    auth_token = token()

    if args.command in ("create-link", "create"):
        request(
            "POST",
            "/links/create/",
            auth_token,
            {
                "case_id": args.case_id,
                "storage_region": args.region,
            },
            timeout=args.timeout,
            json_output=args.json,
        )

    elif args.command in ("links", "list-links"):
        request(
            "GET",
            "/links/",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
        )

    elif args.command in ("link", "get-link"):
        request(
            "GET",
            f"/links/{args.uuid}",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
        )

    elif args.command in ("files", "list-files"):
        request(
            "GET",
            f"/links/{args.uuid}/files",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
        )

    elif args.command in ("extend", "extend-expiration"):
        if args.days < 1 or args.days > 365:
            print(
                "Days must be between 1 and 365.",
                file=sys.stderr,
            )
            sys.exit(2)

        if not args.yes:
            confirm(
                f"Extend file {args.upload_id} expiration by {args.days} days?"
            )

        request(
            "POST",
            f"/uploads/{args.upload_id}/extend_expiration"
            f"?additional_days={args.days}",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
        )

    elif args.command in ("delete", "delete-file"):
        if not args.yes:
            confirm(
                f"Mark file {args.upload_id} for deletion?"
            )

        request(
            "POST",
            f"/uploads/{args.upload_id}/mark_for_deletion",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
        )

    elif args.command in ("delete-all", "delete-link-files"):
        if not args.yes:
            confirm(
                f"Mark all files for link {args.uuid} for deletion?"
            )

        request(
            "POST",
            f"/links/{args.uuid}/mark_all_for_deletion",
            auth_token,
            timeout=args.timeout,
            json_output=args.json,
        )


if __name__ == "__main__":
    main()