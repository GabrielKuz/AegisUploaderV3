# UploaderV3 CLI

A command-line interface for interacting with UploaderV3.

## Authentication

Commands that access or modify upload data require an Entra access token. It can be found by logging into the main domain with one's network tab open, then selecting a succesful request, scrolling down to the Authroization header, and copying the value.  

```powershell
$env:ACCESS_TOKEN="your-token"
```

The `health` command does not require authentication.

## Commands

### Health

Check whether the API is available.

```powershell
python uploaderV3-cli.py health
```

### Create Upload Link

Create a new upload link for a case.

```powershell
python uploaderV3-cli.py create-link <case_id>
```

Specify the storage region with `--region`:

```powershell
python uploaderV3-cli.py create-link <case_id> --region US
python uploaderV3-cli.py create-link <case_id> --region EU
```

The command returns the upload URL and UUID.

### List Links

List available upload links.

```powershell
python uploaderV3-cli.py links
```

### Get Link

Get information about a specific upload link.

```powershell
python uploaderV3-cli.py link <uuid>
```

### List Files

List files associated with an upload link.

```powershell
python uploaderV3-cli.py files <uuid>
```

### Extend File Expiration

Extend an upload's expiration date.

```powershell
python uploaderV3-cli.py extend <upload_id> <days>
```

Example:

```powershell
python uploaderV3-cli.py extend 6bcc1bef-1f24-4315-9627-e778705277c8 7
```

### Mark Upload for Deletion

Mark a specific upload for deletion.

```powershell
python uploaderV3-cli.py delete <upload_id>
```

### Mark All Uploads for Deletion

Mark all uploads associated with a link for deletion.

```powershell
python uploaderV3-cli.py delete-all <uuid>
```

### Request Link Deletion

Submit a deletion request for a link.

```powershell
python uploaderV3-cli.py request-deletion <uuid>
```

## Command Reference

| Command            | Argument            | Purpose                       |
| ------------------ | ------------------- | ----------------------------- |
| `health`           | —                   | Check API health              |
| `create-link`      | `case_id`           | Create an upload link         |
| `links`            | —                   | List upload links             |
| `link`             | `uuid`              | Get link details              |
| `files`            | `uuid`              | List files for a link         |
| `extend`           | `upload_id`, `days` | Extend file expiration        |
| `delete`           | `upload_id`         | Mark one upload for deletion  |
| `delete-all`       | `uuid`              | Mark all uploads for deletion |
| `request-deletion` | `uuid`              | Request deletion of a link    |

## Typical Workflow

Create a link:

```powershell
python uploaderV3-cli.py create-link AIS-7002
```

Check the link:

```powershell
python uploaderV3-cli.py link <uuid>
```

List uploaded files:

```powershell
python uploaderV3-cli.py files <uuid>
```

Extend an upload if needed:

```powershell
python uploaderV3-cli.py extend <upload_id> 7
```

For deletion operations:

```powershell
python uploaderV3-cli.py delete <upload_id>
python uploaderV3-cli.py delete-all <uuid>
python uploaderV3-cli.py request-deletion <uuid>
```

## Help

Show available commands:

```powershell
python uploaderV3-cli.py -h
```

Show command-specific help:

```powershell
python uploaderV3-cli.py create-link -h
python uploaderV3-cli.py extend -h
python uploaderV3-cli.py delete -h
```
