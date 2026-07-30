# Architecture diagrams
## Component architeture
```mermaid
flowchart TD

    subgraph API

        Auth

        LinkGenerator

        UploadAPI

    end

    subgraph Services

        StorageProvider

        HubSpotIntegration

        AuditLogging

        RateLimiter

    end

    subgraph Persistence

        PostgreSQL

        AzureStorage

    end

    Auth --> LinkGenerator

    Auth --> UploadAPI

    LinkGenerator --> HubSpotIntegration

    LinkGenerator --> PostgreSQL

    UploadAPI --> StorageProvider

    UploadAPI --> PostgreSQL

    StorageProvider --> AzureStorage

    UploadAPI --> AuditLogging

    UploadAPI --> RateLimiter
```
## Request flow
```mermaid
sequenceDiagram

    participant User

    participant API

    participant DB

    participant Storage

    participant HubSpot

    User->>API: Generate Upload Link

    API->>HubSpot: Validate Case

    HubSpot-->>API: Metadata

    API->>DB: Store Link

    API-->>User: Upload URL

    User->>API: Start Upload

    API->>DB: Create UploadSession

    API->>Storage: Prepare Blob

    loop Upload Chunks

        User->>API: Chunk

        API->>Storage: Write Range

        API->>DB: Record Chunk

    end

    User->>API: Complete Upload

    API->>DB: Create UploadRecord

    API-->>User: Upload Complete
```
## Upload lifecycle
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Storage

    Client->>API: Start Upload (filename,size,hash)
    API->>DB: Create UploadSession
    API->>Storage: Prepare File
    API-->>Client: Upload Token + Chunk Size

    loop Each Chunk
        Client->>API: Upload Chunk + Offset + Hash
        API->>API: Verify BLAKE3 Chunk Hash
        API->>Storage: Write Range
        API->>DB: Save Chunk Metadata
        API-->>Client: Confirm Range Received
    end

    Client->>API: Complete Upload
    API->>DB: Load Chunk Hashes
    API->>API: Compute Merkle Root
    API->>API: Verify File Hash

    API->>DB: Create UploadRecord
    API->>DB: Mark Session Complete
    API->>Client: Upload Complete
    API->>Email: Send Completion Notification
```
## Database tables
```mermaid
erDiagram

    LinkRecord {
        UUID uuid PK
        String case_id
        String link
        String creator
        Boolean itar
        StorageRegion storage_region
        DateTime expiration_date
        Boolean expired
        String customer
        String status
        JSON users_with_access
    }

    UploadSession {
        UUID upload_id PK
        String upload_token UK
        UUID link_uuid
        String case_id
        String blob_name
        String original_filename
        BigInteger expected_size
        String expected_hash
        String hash_algorithm
        JSON received_ranges
        BigInteger received_size
        BigInteger chunk_size
        Boolean completed
        Boolean itar_status
        StorageRegion storage_region
        DateTime created
        DateTime last_activity
    }

    UploadChunk {
        UUID id PK
        UUID upload_id FK
        BigInteger offset
        Integer size
        Integer chunk_index
        String hash
        String algorithm
        Boolean uploaded
    }

    UploadRecord {
        UUID upload_id PK
        UUID link_uuid FK
        String case_id
        String original_filename
        String blob_name
        String content_type
        String file_hash
        BigInteger combined_file_size
        DateTime date_uploaded
        StorageRegion storage_region
        Boolean upload_complete
        Boolean requested_for_deletion
        Boolean for_deletion
        Integer max_days_in_storage
        JSON users_with_access
    }


    LinkRecord ||--o{ UploadRecord : "has completed uploads"

    UploadSession ||--o{ UploadChunk : "contains chunks"

    UploadSession ||--|| UploadRecord : "becomes completed upload"

    LinkRecord ||--o{ UploadSession : "creates upload sessions"
```
## Scheduled Jobs
```mermaid
flowchart TD

    Scheduler[APScheduler via Gunicorn]

    subgraph Jobs[Scheduled Jobs]

        Cleanup[Data Cleaner<br/>expireAndDeleteOldData]

        Refresh[HubSpot Refresher<br/>update_link_status_from_hubspot]

    end


    subgraph CleanupFlow[Expiration & Cleanup Pipeline]

        ExpireUploads[Expire Uploads<br/>Retention + Case Expiration]
        ExpireLinks[Expire Links<br/>Link Lifetime]

        DeleteSessions[Delete Completed Upload Sessions]

        DeleteFiles[Delete Expired Files<br/>Azure Storage]

        DeleteLinks[Delete Expired Links]

        RemoveOrphans[Remove Orphaned Storage Files]

        RemoveDirs[Remove Empty Case Directories]

    end


    subgraph Database[PostgreSQL]

        Links[LinkRecord]
        Sessions[UploadSession]
        Chunks[UploadChunk]
        Uploads[UploadRecord]

    end


    subgraph Storage[Azure Storage]

        US[US Storage]
        EU[EU Storage]
        ITAR[ITAR Storage]

    end


    subgraph External[External Systems]

        HubSpot[HubSpot]
    end


    Scheduler --> Cleanup
    Scheduler --> Refresh


    Cleanup --> ExpireUploads
    Cleanup --> ExpireLinks

    ExpireUploads --> Uploads
    ExpireLinks --> Links

    ExpireUploads --> DeleteSessions
    DeleteSessions --> Sessions

    Cleanup --> DeleteFiles
    DeleteFiles --> US
    DeleteFiles --> EU
    DeleteFiles --> ITAR

    Cleanup --> DeleteLinks
    DeleteLinks --> Links

    Cleanup --> RemoveOrphans
    RemoveOrphans --> Storage

    Cleanup --> RemoveDirs
    RemoveDirs --> Storage


    Refresh --> HubSpot
    HubSpot --> Refresh

    Refresh --> Links
```
## Link generation sequence
```mermaid
sequenceDiagram

    participant User
    participant API
    participant HubSpot
    participant Database

    User->>API: Request upload link (case_id, storage_region)

    API->>API: Validate authentication

    API->>API: Validate Case ID

    API->>HubSpot: Verify case exists

    HubSpot-->>API: Case metadata\n(company, ITAR, status)

    API->>API: Generate UUID

    API->>Database: Create LinkRecord

    Database-->>API: Link stored

    API-->>User: Return upload URL + UUID
```
## Authentication identity model
```mermaid
classDiagram

    class User {
        +username
        +roles[]
        +disabled
    }

    class Token {
        +access_token
        +token_type
    }

    class JWT {
        preferred_username
        upn
        oid
        roles[]
        aud
        iss
        exp
    }

    JWT --> User : Creates
    Token --> JWT : Decoded Into
```
## Process diagram
```mermaid
flowchart TD

    Supervisor

    Supervisor --> Gunicorn

    Gunicorn --> Worker1["Uvicorn Worker"]
    Gunicorn --> Worker2["Uvicorn Worker"]
    Gunicorn --> Worker3["Uvicorn Worker"]
    Gunicorn --> Worker4["Uvicorn Worker"]
    Gunicorn --> Worker5["Uvicorn Worker"]
    Gunicorn --> Worker6["Uvicorn Worker"]

    Supervisor --> Scheduler

    Scheduler --> Cleanup["Data Cleanup Jobs"]

    Scheduler --> Refresh["HubSpot Status Refresh"]
```
