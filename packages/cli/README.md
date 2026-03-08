## Install

```bash
npm i -g stoat.run
pnpm add -g stoat.run
yarn global add stoat.run
bun add -g stoat.run
```

## Usage

### `stoat http <port>`

Expose a local HTTP server.

```bash
stoat http 3000
stoat http 3000 --slug my-app
stoat http 3000 --auth user:pass
stoat http 3000 --expiry 3600
```

| Option               | Description                                |
| -------------------- | ------------------------------------------ |
| `--slug <slug>`      | Request a specific slug for the public URL |
| `--auth <user:pass>` | Require basic auth for public access       |
| `--expiry <seconds>` | Session expiry in seconds                  |

### `stoat status`

Show the current tunnel status.

```bash
stoat status
```

## Environment

- `STOAT_CONTROL_PLANE_URL` (default: `https://cp.stoat.run`)
