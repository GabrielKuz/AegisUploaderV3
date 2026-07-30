# UploaderV3 CLI

A command-line interface for interacting with UploaderV3.

To use, download `uploaderV3-cli.py` and add it to your working directory or `PATH`.

## Global Options

These options can be used with any command:

```powershell
python uploaderV3-cli.py [OPTIONS] COMMAND
```

### `--json`

Output API responses as formatted JSON instead of human-readable output.

```powershell
python uploaderV3-cli.py --json links
python uploaderV3-cli.py --json link <uuid>
```

### `--timeout`

Set the HTTP request timeout in seconds. Defaults to `30`.

```powershell
python uploaderV3-cli.py --timeout 60 links
```

The timeout must be at least 1 second.

---

## Authentication

Commands that access upload data require an Entra access token.

The token can be obtained by logging into the main domain with the browser's network tab open, selecting a successful request, locating the `Authorization` header, and copying the token value.

Set the token as `ACCESS_TOKEN`:

```powershell
$env:ACCESS_TOKEN="your-token"
```

The following commands do **not** require authentication:

* `health`
* `status`
* `root`
* `request-deletion`
* `request-delete`

Use `auth-check` to verify that the configured token is valid:

```powershell
python uploaderV3-cli.py auth-check
```

Alias:

```powershell
python uploaderV3-cli.py auth
```

A successful check returns:

```text
Authentication successful.
```

---

## Commands

### Health

Check whether the API is available.

```powershell
python uploaderV3-cli.py health
```

Alias:

```powershell
python uploaderV3-cli.py status
```

The command does not require authentication.

---

### Root

Check the API root endpoint.

```powershell
python uploaderV3-cli.py root
```

The command does not require authentication.

---

### Authentication Check

Verify that `ACCESS_TOKEN` is present and can successfully authenticate against the API.

```powershell
python uploaderV3-cli.py auth-check
```

Alias:

```powershell
python uploaderV3-cli.py auth
```

---

### Create Upload Link

Create a new upload link for a case.

```powershell
python uploaderV3-cli.py create-link <case_id>
```

The default storage region is `US`.

Specify the storage region with `--region`:

```powershell
python uploaderV3-cli.py create-link <case_id> --region US
python uploaderV3-cli.py create-link <case_id> --region EU
```

`--storage-region` can also be used:

```powershell
python uploaderV3-cli.py create-link <case_id> --storage-region EU
```

Alias:

```powershell
python uploaderV3-cli.py create <case_id>
```

A successful human-readable response includes the UUID and upload URL:

```text
Upload link created successfully.
UUID:       <uuid>
Upload URL: <url>
```

---

### List Links

List accessible upload links.

```powershell
python uploaderV3-cli.py links
```

Alias:

```powershell
python uploaderV3-cli.py list-links
```

The human-readable output includes:

* UUID
* Case ID
* Customer
* Status
* Expiration date

Use `--json` when machine-readable output is required:

```powershell
python uploaderV3-cli.py --json links
```

---

### Get Link

Get information about a specific upload link.

```powershell
python uploaderV3-cli.py link <uuid>
```

Alias:

```powershell
python uploaderV3-cli.py get-link <uuid>
```

The human-readable response includes link metadata such as:

* UUID
* Upload URL
* Case ID
* Customer
* Creator
* Storage region
* ITAR status
* Status
* Expiration
* Creation timestamp
* Users with access

---

### List Files

List files associated with an upload link.

```powershell
python uploaderV3-cli.py files <uuid>
```

Alias:

```powershell
python uploaderV3-cli.py list-files <uuid>
```

File information may include:

* Upload ID
* Filename
* Size
* Blob name
* Content type
* Expiration date
* Upload status
* Upload date

---

### Extend File Retention

Extend a file's retention period.

```powershell
python uploaderV3-cli.py extend <upload_id> <days>
```

`<days>` must be between `1` and `365`.

Example:

```powershell
python uploaderV3-cli.py extend 6bcc1bef-1f24-4315-9627-e778705277c8 7
```

Alias:

```powershell
python uploaderV3-cli.py extend-expiration <upload_id> <days>
```

Because this modifies data, the CLI prompts for confirmation:

```text
Extend file <upload_id> expiration by 7 days? [y/N]:
```

Use `--yes` to skip the confirmation prompt:

```powershell
python uploaderV3-cli.py extend <upload_id> 7 --yes
```

---

### Mark File for Deletion

Mark a specific file for deletion.

```powershell
python uploaderV3-cli.py delete <upload_id>
```

Alias:

```powershell
python uploaderV3-cli.py delete-file <upload_id>
```

The command prompts for confirmation:

```text
Mark file <upload_id> for deletion? [y/N]:
```

Use `--yes` to skip confirmation:

```powershell
python uploaderV3-cli.py delete <upload_id> --yes
```

---

### Mark All Files for Deletion

Mark all files associated with a link for deletion.

```powershell
python uploaderV3-cli.py delete-all <uuid>
```

Alias:

```powershell
python uploaderV3-cli.py delete-link-files <uuid>
```

The command prompts for confirmation:

```text
Mark all files for link <uuid> for deletion? [y/N]:
```

Use `--yes` to skip confirmation:

```powershell
python uploaderV3-cli.py delete-all <uuid> --yes
```

---

### Request Data Deletion

Submit a data-deletion request for a link.

```powershell
python uploaderV3-cli.py request-deletion <uuid>
```

Alias:

```powershell
python uploaderV3-cli.py request-delete <uuid>
```

This command does not require an `ACCESS_TOKEN`.

---

## Command Reference

| Command            | Alias               | Arguments           | Purpose                      |
| ------------------ | ------------------- | ------------------- | ---------------------------- |
| `health`           | `status`            | —                   | Check API availability       |
| `root`             | —                   | —                   | Check API root               |
| `auth-check`       | `auth`              | —                   | Verify authentication        |
| `create-link`      | `create`            | `case_id`           | Create an upload link        |
| `links`            | `list-links`        | —                   | List accessible upload links |
| `link`             | `get-link`          | `uuid`              | Get link details             |
| `files`            | `list-files`        | `uuid`              | List files for a link        |
| `extend`           | `extend-expiration` | `upload_id`, `days` | Extend file retention        |
| `delete`           | `delete-file`       | `upload_id`         | Mark one file for deletion   |
| `delete-all`       | `delete-link-files` | `uuid`              | Mark all files for deletion  |
| `request-deletion` | `request-delete`    | `uuid`              | Request data deletion        |

### Command Options

| Command       | Option                    | Purpose                           |
| ------------- | ------------------------- | --------------------------------- |
| All commands  | `--json`                  | Output API responses as JSON      |
| All commands  | `--timeout <seconds>`     | Set request timeout; default `30` |
| `create-link` | `--region US\|EU`         | Set storage region; default `US`  |
| `create-link` | `--storage-region US\|EU` | Alias for `--region`              |
| `extend`      | `--yes`                   | Skip confirmation                 |
| `delete`      | `--yes`                   | Skip confirmation                 |
| `delete-all`  | `--yes`                   | Skip confirmation                 |

---

## Typical Workflow

Set the access token:

```powershell
$env:ACCESS_TOKEN="your-token"
```

Optionally verify authentication:

```powershell
python uploaderV3-cli.py auth-check
```

Create a link:

```powershell
python uploaderV3-cli.py create-link AIS-7002
```

Create an EU link:

```powershell
python uploaderV3-cli.py create-link AIS-7002 --region EU
```

Check the link:

```powershell
python uploaderV3-cli.py link <uuid>
```

List uploaded files:

```powershell
python uploaderV3-cli.py files <uuid>
```

Extend a file's retention:

```powershell
python uploaderV3-cli.py extend <upload_id> 7
```

For non-interactive use, skip the confirmation:

```powershell
python uploaderV3-cli.py extend <upload_id> 7 --yes
```

Mark a file for deletion:

```powershell
python uploaderV3-cli.py delete <upload_id>
```

Mark all files for a link for deletion:

```powershell
python uploaderV3-cli.py delete-all <uuid>
```

Submit a data-deletion request:

```powershell
python uploaderV3-cli.py request-deletion <uuid>
```

---

## JSON Output

Use `--json` when consuming CLI output from scripts or other tooling.

Examples:

```powershell
python uploaderV3-cli.py --json links
```

```powershell
python uploaderV3-cli.py --json link <uuid>
```

```powershell
python uploaderV3-cli.py --json files <uuid>
```

Authentication checks also support JSON output:

```powershell
python uploaderV3-cli.py --json auth-check
```

Successful authentication returns:

```json
{
  "authenticated": true
}
```

---

## Errors

The CLI reports common HTTP failures with a corresponding message.

| HTTP Status | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `400`       | Request contains invalid data                            |
| `401`       | `ACCESS_TOKEN` is missing, expired, invalid, or unusable |
| `403`       | Authenticated user lacks permission                      |
| `404`       | Requested link, file, or case was not found              |
| `410`       | Requested resource has expired                           |
| `422`       | Request parameters failed validation                     |

Network failures and request timeouts are also reported to `stderr`.

The CLI exits with a non-zero status when a request fails or command-line validation fails.

---

## Help

Show global and command help:

```powershell
python uploaderV3-cli.py -h
```

Show command-specific help:

```powershell
python uploaderV3-cli.py health -h
python uploaderV3-cli.py create-link -h
python uploaderV3-cli.py links -h
python uploaderV3-cli.py link -h
python uploaderV3-cli.py files -h
python uploaderV3-cli.py extend -h
python uploaderV3-cli.py delete -h
python uploaderV3-cli.py delete-all -h
python uploaderV3-cli.py request-deletion -h
```
