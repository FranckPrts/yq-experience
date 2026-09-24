# Administration

How people get into yq-experiences, and how an administrator gets back in when
nobody can.

## Roles

| | Can |
| --- | --- |
| **Platform administrator** | See every project, invite people, grant and remove administrator access |
| **Project owner** | Everything in their project: members, database, opening and closing |
| **Project collaborator** | Style, script and parameters |
| **Project viewer** | Look, not change |

Platform admin is account-wide. Project roles belong to one project each.

## Getting people in

Registration is **invite-only**. There is no public sign-up page.

- **A platform admin** invites anyone from `/admin/invitations`, optionally
  straight into a project with a role. The link can be pinned to one email
  address, or left open to hand over in person.
- **A project owner** invites co-tenants from their project's overview page.
  These links are always pinned to one email address.
- Someone who **already has an account** opens the link, signs in, and joins in
  one click.

A link is shown once — only its hash is stored — works once, and expires.

## Making someone an administrator

Administrator access is **never sent as a link**. A link works for whoever holds
it, and this role reaches every project.

1. Invite the person as a normal user.
2. Once they have signed up, an existing administrator promotes them by email in
   the **administrators** section of `/admin/invitations`.

Nobody can remove their own administrator access, and the last administrator
cannot be removed. Removal takes effect on the person's next click.

## `npm run admin` — first administrator, and the way back in

Invite-only registration has a bootstrapping problem: the very first account
cannot be invited, because there is no one to invite it. The same command also
recovers the platform if every administrator is locked out.

```sh
nvm use
npm run admin -- --email someone@example.com --password 'a-long-password' --name 'Name'
```

- If the account does not exist, it is created as an administrator.
- If it exists, its password is reset and it is made an administrator.
- Either way, **every session that account already has is signed out** — a
  password reset that leaves old sessions alive is not a reset.
- Omit `--password` to have one generated and printed once.

It needs shell access to the server and the database connection in `.env`. That
requirement is the security model: it is deliberately not reachable from the
web.

Use it for bootstrap and recovery only. Day to day, promote people from
`/admin/invitations`, which keeps a person in the loop who can see who is being
promoted.

## Related commands

| Command | Does |
| --- | --- |
| `npm run invite -- --by admin@example.com --email them@example.com` | Create an invitation from the terminal |
| `npm run project:create -- …` | Create a project from the terminal |
| `npm run visual:check -- visuals/<name>` | Validate a visual's declaration without uploading it |
| `npm run connection:verify -- <slug>` | Prove a project's stored Supabase secret decrypts |

All of them need `nvm use` first — the machine's default Node is too old for
Prisma 7.
