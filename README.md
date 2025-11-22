# traffic-jam-session
Redis locks for multithreaded app

A Node.js application implementing the Mutual Exclusion (Mutex) Pattern using Redis for distributed locking. This app manages locks for users, companies, and contracts to prevent concurrent access conflicts.

## Features

- **User Locking**: Lock individual users to prevent concurrent modifications
- **Company Locking**: Lock entire companies (and all their users) atomically
- **Contract Locking**: Lock individual contracts
- **TTL Support**: Locks automatically expire after a specified time
- **Process-based Ownership**: Only the process that acquired a lock can release it
- **RESTful API**: Easy-to-use HTTP endpoints for all lock operations

## Architecture

The application uses Redis as a distributed lock manager with the following lock types:

1. **User Locks** (`lock:user:{userId}`): Controls access to individual users
2. **Company Locks** (`lock:company:{companyId}`): Controls access to entire companies
3. **Contract Locks** (`lock:contract:{contractId}`): Controls access to contracts

## Prerequisites

- Docker
- Docker Compose

## Getting Started

### Build and Run with Docker Compose

```bash
# Build and start the services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

This will start:
- **app**: The Node.js application on port 3000
- **redis**: Redis server on port 6379

### Stop the services

```bash
docker-compose down
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f redis
```

### Test the API

After starting the services, you can use the included test script:

```bash
# Make sure jq is installed for JSON formatting
# sudo apt-get install jq  # On Ubuntu/Debian
# brew install jq          # On macOS

./test-api.sh
```

Or test manually with curl (see examples below).

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "redis": "connected"
}
```

### User Locks

#### Lock a User

```bash
POST /lock/user/:userId
Content-Type: application/json

{
  "processId": "process-123",
  "ttl": 30
}
```

#### Unlock a User

```bash
POST /unlock/user/:userId
Content-Type: application/json

{
  "processId": "process-123"
}
```

#### Check User Lock Status

```bash
GET /lock/user/:userId
```

### Company Locks

#### Lock a Company

```bash
POST /lock/company/:companyId
Content-Type: application/json

{
  "processId": "process-123",
  "userIds": ["user1", "user2", "user3"],
  "ttl": 30
}
```

#### Unlock a Company

```bash
POST /unlock/company/:companyId
Content-Type: application/json

{
  "processId": "process-123",
  "userIds": ["user1", "user2", "user3"]
}
```

#### Check Company Lock Status

```bash
GET /lock/company/:companyId
```

### Contract Locks

#### Lock a Contract

```bash
POST /lock/contract/:contractId
Content-Type: application/json

{
  "processId": "process-123",
  "ttl": 30
}
```

#### Unlock a Contract

```bash
POST /unlock/contract/:contractId
Content-Type: application/json

{
  "processId": "process-123"
}
```

#### Check Contract Lock Status

```bash
GET /lock/contract/:contractId
```

## Usage Examples

### Example 1: Lock a User

```bash
# Lock user "user-456" with process "worker-1" for 60 seconds
curl -X POST http://localhost:3000/lock/user/user-456 \
  -H "Content-Type: application/json" \
  -d '{"processId": "worker-1", "ttl": 60}'

# Check lock status
curl http://localhost:3000/lock/user/user-456

# Unlock the user
curl -X POST http://localhost:3000/unlock/user/user-456 \
  -H "Content-Type: application/json" \
  -d '{"processId": "worker-1"}'
```

### Example 2: Lock an Entire Company

```bash
# Lock company "company-789" with all its users
curl -X POST http://localhost:3000/lock/company/company-789 \
  -H "Content-Type: application/json" \
  -d '{
    "processId": "batch-job-5",
    "userIds": ["user-100", "user-101", "user-102"],
    "ttl": 120
  }'

# Check company lock status
curl http://localhost:3000/lock/company/company-789

# Unlock the company
curl -X POST http://localhost:3000/unlock/company/company-789 \
  -H "Content-Type: application/json" \
  -d '{
    "processId": "batch-job-5",
    "userIds": ["user-100", "user-101", "user-102"]
  }'
```

### Example 3: Lock a Contract

```bash
# Lock contract "contract-555"
curl -X POST http://localhost:3000/lock/contract/contract-555 \
  -H "Content-Type: application/json" \
  -d '{"processId": "service-a", "ttl": 45}'

# Check contract lock status
curl http://localhost:3000/lock/contract/contract-555

# Unlock the contract
curl -X POST http://localhost:3000/unlock/contract/contract-555 \
  -H "Content-Type: application/json" \
  -d '{"processId": "service-a"}'
```

## Environment Variables

- `PORT`: Application port (default: 3000)
- `REDIS_URL`: Redis connection URL (default: redis://redis:6379)

## Lock Behavior

1. **Atomic Locks**: All lock operations use Redis SET NX (set if not exists) for atomic acquisition
2. **TTL**: Locks automatically expire after the specified TTL (default: 30 seconds)
3. **Process Ownership**: Only the process that acquired a lock can release it
4. **Company Locks**: Locking a company locks both the company entity and all specified users
5. **Conflict Detection**: Returns 409 status when a lock is already held by another process

## Development

### Run without Docker

```bash
# Install dependencies
npm install

# Set environment variables
export REDIS_URL=redis://localhost:6379

# Start Redis locally
redis-server

# Start the application
npm start
```

## License

ISC
