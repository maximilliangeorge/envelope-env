# Envelope 📨

Envelope is a CLI tool that compiles a `.env` file from a set of environment-specific configurations. Organise your environment variables in an `env/` directory and switch between them by name.

## Installation

### Global Installation

```bash
npm install -g envelope-env
```

### Local Development

```bash
git clone <repository-url>
cd envelope-node
npm install
npm run build
```

## Project Structure

Envelope expects your project to have an `env/` directory containing your environment configurations. Two layouts are supported, but they cannot be mixed in the same project.

### Directory Mode

```
your-project/
├── env/
│   ├── .env                # Common variables (shared across all envs)
│   ├── development/
│   │   └── .env            # Development-specific variables
│   ├── staging/
│   │   └── .env            # Staging-specific variables
│   └── production/
│       └── .env            # Production-specific variables
├── .env                    # Compiled by running `envelope use <environment>`
└── ...
```

### Flat Mode

```
your-project/
├── env/
│   ├── .env                 # Common variables (shared across all envs)
│   ├── .env.development     # Development-specific variables
│   ├── .env.staging         # Staging-specific variables
│   └── .env.production      # Production-specific variables
├── .env                     # Compiled by running `envelope use <environment>`
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
```

**Options:**

- `--silent, -s` - Suppress status messages

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
3. **Environment-specific variables** - From `env/<environment>/.env` or `env/.env.<environment>`

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
