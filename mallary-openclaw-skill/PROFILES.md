# Mallary Profiles

Profiles group your social media accounts. You can create one profile for each of your businesses. Then connect the social media accounts of each business inside its profile. If you do not send a `profile_id` with a request, Mallary uses your default profile.

Mallary profiles group social platform connections, posts, analytics, and brand or AI auto-reply settings. The dashboard has one top-level **Dashboard profile** bar. After you select a profile there, the posts, platforms, analytics, and settings below belong to that profile.

## Default Profile

Every user has a default profile. If a CLI command or API request omits `profile_id`, Mallary uses the user's default profile.

When a user manages more than one brand, business, client, or set of social accounts, use a non-default profile.

## Public Profile IDs

Profiles have random public IDs such as `AbC123xYz90`. Use these public IDs in CLI flags and API payloads, not internal database IDs.

Find the profile ID in either place:

Privacy warning: profile IDs, profile names, connected-platform state, and profile-scoped settings are sensitive operational metadata. Request only the profile ID that you need. Redact the profile details and the account details before you share logs, screenshots, tickets, or agent transcripts.

```bash
mallary profiles list
mallary profiles list --json
```

Or copy it from the **Dashboard profile** bar in the Mallary dashboard.

## CLI Commands That Accept Profiles

The CLI can list profiles and target a profile with `--profile-id`:

Warning: the commands in this block are not all read-only. `posts create` publishes or schedules content. `settings update` changes the profile behavior. `platforms disconnect` ends the platform access of Mallary until you connect the platform again. Make sure that the target profile ID and the side effect are correct before you run these commands.

```bash
mallary profiles list
mallary posts create --message "Launch update" --platform linkedin --profile-id AbC123xYz90
mallary posts list --profile-id AbC123xYz90
mallary analytics list --profile-id AbC123xYz90
mallary audience list --profile-id AbC123xYz90
mallary settings get --profile-id AbC123xYz90
mallary settings update --file settings.partial.json --profile-id AbC123xYz90
mallary platforms list --profile-id AbC123xYz90
mallary platforms disconnect facebook --profile-id AbC123xYz90
```

In file mode, send `profile_id` in the JSON payload:

```json
{
  "profile_id": "AbC123xYz90",
  "message": "Launch update",
  "platforms": ["facebook", "linkedin"]
}
```

The CLI lists profiles and targets them. The dashboard and the REST API create and rename profiles.

## API Endpoints

Profile-aware API behavior:

- `GET /api/v1/profiles` lists profiles, each profile's connected platforms, and the user's profile/account limit.
- `POST /api/v1/profiles` creates a named non-default profile.
- `POST /api/v1/profiles/{id}` renames a profile.
- you can send `profile_id` with these operations: create a post, list posts, list analytics, list platforms, disconnect a platform, and read or update settings.
- Omitting `profile_id` selects the default profile.

## Profile-Scoped Behavior

- Platform connections are profile-scoped. Connect accounts in the dashboard after selecting the intended Dashboard profile.
- Posts and grouped post history are profile-scoped.
- Post analytics and audience queries are profile-scoped.
- Settings are profile-scoped. They include `auto_reply_enabled`, the business fields, the brand profile text, and the AI auto-reply context.
- `--auto-reply-enabled` on a post also depends on the saved settings of the selected profile and on the plan access.

## Account allowance

`GET /api/v1/profiles` returns the workspace's current `data.limits`. For account-based plans, `account_limit_scope` is `total` and `max_accounts_total` is shared across platforms and profiles.

| Plan | Total social media accounts | Monthly price |
| --- | ---: | ---: |
| Starter | 5 | $15 |
| Pro | 15 | $29 |
| Business | 100 | $99 |

Posts are unlimited. Profiles group your accounts; they do not add account spots. Each profile holds one account per platform. You can use several profiles for several accounts on the same platform.

Existing customers keep their current limits. Use the limits returned for the authenticated workspace instead of inferring them from the plan name. The compatibility field `max_accounts_per_platform` remains available for older contracts.

X publishing and comments use prepaid credits at cost. Analytics and account lookups do not use credits. See https://mallary.ai/pricing for current offers.
