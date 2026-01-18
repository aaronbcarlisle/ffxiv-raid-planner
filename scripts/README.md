# Scripts

Utility scripts for the FFXIV Raid Planner project.

## Discord Changelog (`discord-changelog.js`)

Posts changelog updates to Discord when PRs are merged to main.

### Features

- **Release Announcements**: When a new version is detected in `releaseNotes.ts`, posts a rich embed with version info, highlights, and a link to full release notes
- **Commit Notifications**: Posts commit title and AI-summarized body as Discord embeds with color-coded types
- **Intelligent Summarization**: Uses AI to generate concise, readable changelog entries (with fallback to smart truncation)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token with permissions to post in the changelog channel |
| `DISCORD_CHANGELOG_CHANNEL_ID` | Yes | ID of the Discord channel to post notifications |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI-powered commit summarization. If not provided, uses length-based truncation (see Discord Embed Limits below). |
| `COMMIT_SHA` | Yes | The commit hash (auto-provided by GitHub Actions) |
| `COMMIT_MESSAGE` | Yes | The full commit message (auto-provided by GitHub Actions) |
| `GITHUB_REPOSITORY` | Yes | Repository in `owner/repo` format (auto-provided by GitHub Actions) |

### Discord Bot Setup

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot for the application
3. Copy the bot token (keep secret!)
4. Invite the bot to your server with these permissions:
   - Send Messages
   - Embed Links
5. Get the channel ID (Enable Developer Mode in Discord settings, right-click channel > Copy ID)
6. Add secrets to GitHub repository:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CHANGELOG_CHANNEL_ID`

### Local Testing

```bash
# Install dependencies
cd scripts
npm install

# Set environment variables
export DISCORD_BOT_TOKEN="your-test-bot-token"
export DISCORD_CHANGELOG_CHANNEL_ID="your-test-channel-id"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export COMMIT_SHA="abc1234"
export COMMIT_MESSAGE="test: sample commit message"
export GITHUB_REPOSITORY="owner/repo"

# Run the script
node discord-changelog.js
```

**Tip**: Create a separate test Discord server and bot for local testing to avoid posting to your production changelog channel.

### Running Tests

```bash
cd scripts
npm install
npm test
```

### Discord Embed Limits

The script respects Discord's embed limits:

| Field | Limit |
|-------|-------|
| Title | 256 characters |
| Description | 500 characters (for concise, scannable posts) |

Long commit messages are automatically summarized or truncated to fit within these limits.

### AI Summarization

Commit messages are summarized using Claude AI (Haiku model) to create concise, readable changelog entries. The AI:

- Generates summaries under 500 characters
- Focuses on WHAT changed and WHY
- Automatically excludes AI tool attributions from summaries
- Falls back to simple truncation if the API is unavailable
- Includes a 10-second timeout to prevent CI pipeline hangs

This approach eliminates the need for complex regex patterns and produces cleaner, more informative changelog posts.

**Security Note:** Commit messages are passed directly to the AI prompt. This is safe for internal use since commits require repository write access. The Anthropic API includes built-in safety measures against prompt injection.

### Rate Limiting

Discord.js automatically handles Discord API rate limits with built-in retry logic. However, be aware:

- **Normal use**: Single commits merged via PR are well within rate limits
- **Bulk operations**: If many commits are pushed rapidly (e.g., rebasing), Discord's rate limiter may queue messages
- **Limits**: Discord allows ~5 messages per 5 seconds per channel (varies by endpoint)

The script uses `client.destroy()` after sending to properly close the connection. No manual rate limit handling is required for typical CI/CD usage.
