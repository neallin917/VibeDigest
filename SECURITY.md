# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 3.4.x   | :white_check_mark: |
| 3.3.x   | :white_check_mark: |
| < 3.3   | :x:                |

## Reporting a Vulnerability

We take the security of VibeDigest seriously. If you discover a security vulnerability, please report it responsibly.

**Please DO NOT file a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email your findings to **neallin917@gmail.com** with the subject line: `[SECURITY] VibeDigest Vulnerability Report`
2. Include the following details:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
- **Assessment**: We will investigate and provide an initial assessment within **5 business days**.
- **Resolution**: Critical vulnerabilities will be patched as soon as possible. We will coordinate disclosure timing with you.

### Scope

The following are in scope:
- The VibeDigest web application (vibedigest.io)
- The backend API
- Authentication and authorization mechanisms
- Data handling and storage

### Out of Scope

- Third-party services (Supabase, OpenAI, etc.)
- Social engineering attacks
- Denial of service attacks

## Security Best Practices for Contributors

- Never commit secrets, API keys, or credentials to the repository
- Use environment variables for all sensitive configuration
- Follow the principle of least privilege for database access
- Validate and sanitize all user input
- Keep dependencies up to date
