# Stage 9 — Study Groups and Shared Resources

## 1. Features

- Create a study group with name, description, optional course, and visibility.
- Browse discoverable groups.
- Join public groups or private groups through valid invitations.
- Invite classmates.
- Roles: owner, moderator, member.
- Basic text discussions and announcements.
- Share selected resources.
- Schedule study sessions.
- Report inappropriate content and leave a group.

## 2. Group membership rules

- Creator becomes owner.
- Members cannot grant themselves roles.
- Only owner/moderators can perform moderation actions permitted by policy.
- Ownership transfer must be an explicit secure operation.
- Removing the last owner must be prevented or require ownership transfer.
- Private group details and content are available only to members.
- Group discovery must not leak private group descriptions or member lists.

## 3. Invitations

- Use high-entropy tokens; store a hash rather than the raw token if practical.
- Support expiry, revocation, and optional maximum uses.
- Validate token, group status, expiration, and use count server-side.
- Avoid placing private user information in invitation URLs.
- Do not rely on a hidden button as protection.

## 4. Discussions

- Basic text messages first.
- Validate length and content type.
- Escape/render user content safely.
- Add pagination rather than loading all history.
- Consider rate limits and report/block tools.
- Avoid storing secrets or provider tokens in messages.

## 5. Sharing resources

- Resource owner explicitly chooses to share.
- Verify that the user can share the source.
- Store a share relationship or copy a permitted resource record; don't make a private file public.
- Verify group membership on every download or preview.
- If owner deletes a source, define whether the group share is removed or retained as an authorized copy.

## 6. Study sessions

- Title, group, start time, end time, optional agenda.
- Time zone aware display.
- Members can view sessions according to group access.
- Authorized roles can create, update, or cancel sessions.
- Calls are integrated in Stage 10, not faked in this stage.

## 7. Moderation and privacy

- Provide report and leave-group paths.
- Avoid exposing a member's email address unnecessarily.
- Validate all user-generated content.
- Keep moderation actions auditable without excessive personal data.

## 8. Acceptance criteria

- Public group discovery works.
- Private groups require a valid invite or authorized membership.
- Member roles cannot be escalated by clients.
- Discussions and resource sharing obey membership policies.
- Group pages work on mobile and show loading/empty/error states.
