# Envelope 📨

Envelope is a CLI tool that compiles a `.env` file from a set of environment-specific configurations. Organise your environment variables in an `env/` directory and switch between them by name.

## Installation

### Global Installation

```bash
npm install -g envelope-env
```

### Usage

```bash
envelope use <environment>
```

## Project Structure

Envelope expects your project to have an `env/` directory containing one subdirectory per environment.

```
your-project/
├── env/
│   ├── .env                # Common variables (shared across all envs)
│   ├── pre                 # Optional: runs before every switch
│   ├── post                # Optional: runs after every switch
│   ├── development/
│   │   └── .env            # Development-specific variables
│   ├── staging/
│   │   ├── .env            # Staging-specific variables
│   │   └── post            # Optional: runs after switching to staging
│   └── production/
│       ├── .env            # Production-specific variables
│       └── pre             # Optional: runs before switching to production
├── .env                    # Compiled by running `envelope use <environment>`
└── ...
```

## Usage

### Commands

#### `envelope list`

List all available environments in your project.

```bash
envelope list
```

**Output:**

```
Available environments: development, staging, production
```

#### `envelope get <environment>`

Display the compiled environment variables for a specific environment without writing to file.

```bash
envelope get development
envelope get production --silent
```

**Options:**

- `--silent, -s` - Suppress status messages

#### `envelope use <environment>`

Compile and write environment variables for a specific environment to your project's `.env` file.

```bash
envelope use development
envelope use production --silent
envelope use production --no-hooks
```

**Options:**

- `--silent, -s` - Suppress status messages
- `--no-hooks` - Skip pre and post hooks

#### `envelope current`

Print the currently active environment (reads `ENVELOPE_ENV` from the compiled `.env` file).

```bash
envelope current
```

### Examples

#### Setting up a new environment

1. Create your environment directory:

```bash
mkdir -p env/staging
```

2. Create environment-specific variables:

```bash
# env/staging/.env
DATABASE_URL=postgresql://staging:pass@localhost:5432/staging_db
API_URL=https://staging-api.example.com
LOG_LEVEL=debug
```

3. Use the environment:

```bash
envelope use staging
```

#### Viewing environment variables

```bash
# View development environment variables
envelope get development

# View production environment variables silently
envelope get production --silent
```

## Hooks

Envelope can run shell scripts before and after `envelope use` writes the compiled `.env` file. Hooks are plain files named `pre` or `post`, run with `sh`, so they do not need to be executable.

| Location                | When it runs                                |
| ----------------------- | ------------------------------------------- |
| `env/pre`               | Before every switch                         |
| `env/<environment>/pre` | Before switching to `<environment>`         |
| `env/post`              | After every switch                          |
| `env/<environment>/post`| After switching to `<environment>`          |

Common hooks run before environment-specific ones. The full order is: common `pre`, environment `pre`, write `.env`, common `post`, environment `post`.

Hooks run from the project root with the compiled environment variables available in their environment, including `ENVELOPE_ENV`. If a `.env` file already existed, `ENVELOPE_PREVIOUS_ENV` is set to the environment it was compiled for.

```bash
# env/post
docker compose up -d --force-recreate
npx prisma generate
```

```bash
# env/production/pre
if [ "$ENVELOPE_PREVIOUS_ENV" != "production" ]; then
  echo "Switching from $ENVELOPE_PREVIOUS_ENV to production"
fi
```

If a `pre` hook exits with a non-zero status, `.env` is not written and `envelope` exits with status 1. If a `post` hook fails, `.env` has already been written and `envelope` exits with status 1 after reporting the failure. Pass `--no-hooks` to skip hooks entirely.

## Environment File Format

Environment files follow standard `.env` format:

```bash
# Comments start with #
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=your-secret-key
DEBUG=true

# Empty lines are allowed

# Variables can contain spaces and special characters
COMPLEX_VALUE="This is a complex value with spaces"
```

## Environment Variable Precedence

When compiling environment variables, Envelope follows this order:

1. **Base variables** - `ENVELOPE_ENV` and `ENVELOPE_DIR` are always set automatically
2. **Common variables** - From `env/.env` (if it exists)
3. **Environment-specific variables** - From `env/<environment>/.env`

Environment-specific variables will override common variables with the same name.

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[WTFPL](https://www.wtfpl.net/)
