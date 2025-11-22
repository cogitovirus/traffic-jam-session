# traffic-jam-session
Redis locks for multithreaded app

## Requirements

Install GNU Parallel:

```bash
sudo apt-get update
sudo apt-get install parallel
```

## Running Redis with Docker

Start Redis on localhost using Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:latest
```

Stop Redis:

```bash
docker stop redis
```

Remove the container:

```bash
docker rm redis
``` 


---
notes:

company has multiple users.
users can hold contracts
contracts are id's in format 'C123'
there is limited number of contracts available - 10
there are 5 companies (indetified by id like 'XYC Inc')
there are 5 users in each company (username like 'User 1')
there are 10 contracts

5 companies (e.g. "XYC Inc")
each has 5 users ("User 1", "User 2", ...)
there are 10 contracts total, IDs like "C123"

a user can claim contracts
but max 10 contracts total exist globally
multiple workers can run in parallel