# Konga OSS

Nuxt 3 full-stack replacement for classic Konga (Sails + AngularJS).

## Features

- Admin login with an HttpOnly session cookie
- Encrypted Kong node credentials
- Allowlisted Kong Admin proxy
- Management UI for services, routes, consumers, plugins, certificates, upstreams, snapshots, and more

## Screenshots

### Dashboard

![Konga OSS dashboard](screenshots/dashboard.jpg)

### Plugin management

![Konga OSS plugin management](screenshots/plugins.jpg)

### Settings

![Konga OSS settings](screenshots/settings.jpg)

## Run with Docker Compose

### Requirements

- Docker Engine
- Docker Compose v2 (`docker compose`)

### Start the stack

From the repository root, run:

```bash
docker compose up -d
```

The stack contains:

- `konga-oss`: Konga web application
- `konga-database`: PostgreSQL database for Konga
- `kong`: Kong Gateway
- `kong-database`: PostgreSQL database for Kong
- `kong-migration`: one-time Kong database bootstrap

Check the container status:

```bash
docker compose ps
```

Open Konga at <http://localhost:1337>.

### First login

On the first start with an empty Konga database, Konga creates an `admin`
user and prints its generated password once in the application logs:

```bash
docker compose logs konga-oss
```

Sign in at <http://localhost:1337/login>.

To use a fixed bootstrap account, add these environment variables to the
`konga-oss` service before its first start:

```yaml
KONGA_ADMIN_USERNAME: admin
KONGA_ADMIN_EMAIL: admin@konga.local
KONGA_ADMIN_PASSWORD: change-this-password
```

`KONGA_ADMIN_PASSWORD` must contain at least 8 characters.

### Connect Konga to Kong

Create a connection in Konga using:

```text
http://kong:8001
```

Konga and Kong share the `kong-net` Docker network, so the connection must use
the Compose service name `kong`. Kong Admin API is also exposed to the host at
<http://localhost:8001> for direct testing.

### View logs

```bash
docker compose logs -f
```

To view only the application logs:

```bash
docker compose logs -f konga-oss
```

### Stop the stack

Stop containers while keeping database data:

```bash
docker compose down
```

Stop containers and permanently remove both PostgreSQL volumes:

```bash
docker compose down -v
```

## Docker image CI/CD

The GitHub Actions workflow in `.github/workflows/docker-image.yml` builds and
pushes the image after a commit is merged or pushed to `main`.

Configure these repository secrets under **Settings → Secrets and variables →
Actions**:

- `DOCKERHUB_USERNAME`: Docker Hub username
- `DOCKERHUB_TOKEN`: Docker Hub access token with read/write permission

The workflow publishes these tags:

- `<DOCKERHUB_USERNAME>/konga-oss:latest`
- `<DOCKERHUB_USERNAME>/konga-oss:sha-<full-commit-sha>`

## Configuration

The `konga-oss` service uses these environment variables:

| Variable | Description | Compose value / default |
| --- | --- | --- |
| `DATABASE_URL` | Konga PostgreSQL connection URL | `postgresql://konga:konga@konga-database:5432/konga` |
| `NUXT_SESSION_PASSWORD` | Session signing secret; must contain at least 32 characters | Set in `docker-compose.yml` |
| `NODE_CREDENTIALS_KEY` | Encryption key for stored Kong credentials; must contain at least 32 characters | Set in `docker-compose.yml` |
| `COOKIE_SECURE` | Use `false` for local HTTP and `true` when serving through HTTPS | `false` |
| `KONGA_ALLOW_PRIVATE_ADMIN_URL` | Allows Kong Admin URLs on the private Docker network | `true` |
| `KONGA_ADMIN_USERNAME` | Optional initial administrator username | `admin` |
| `KONGA_ADMIN_EMAIL` | Optional initial administrator email | `admin@konga.local` |
| `KONGA_ADMIN_PASSWORD` | Optional initial password; otherwise Konga generates one and prints it once in the logs | Generated |

Replace the default database passwords and application secrets in
`docker-compose.yml` before using this stack outside local development. Keep
`NUXT_SESSION_PASSWORD` and `NODE_CREDENTIALS_KEY` stable after deployment;
changing them invalidates sessions or prevents existing Kong credentials from
being decrypted.
