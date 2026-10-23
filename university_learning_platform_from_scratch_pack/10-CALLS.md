# Stage 10 — Audio/Video Study Calls

## 1. Product goal

Allow students to join a study call from a group or scheduled session without making calls a separate product. Keep the implementation replaceable because provider pricing, policies, and free limits may change.

## 2. Initial option

Evaluate Jitsi Meet for the first prototype. The public `meet.jit.si` service may be suitable for testing, but it is not a promise of unlimited free production capacity. Review current terms, room restrictions, and suitability before a public launch.

### Prototype decision

The initial implementation uses the public `meet.jit.si` Jitsi iframe API as a prototype. StudyStation authorizes a current group member before returning a random room name, but the public Jitsi service does not enforce StudyStation membership: anyone who learns a room name may be able to join directly. This is not a private or production-secure calling solution. The UI must disclose the third-party processing and room-name limitation before loading the provider.

If using a managed SDK or self-hosted server instead, document cost, operations, scaling, privacy, and token/security requirements before implementation.

## 3. UX requirements

- “Join call” button on an authorized group session.
- Display session title, group, and scheduled time.
- Audio-only guidance for weak internet.
- Clear camera/microphone permission prompts.
- Reconnect and leave-call handling.
- Mobile browser support tested on target devices.
- Do not autoplay microphone/camera without user action.
- Explain when a third-party call service is used.
- No call button should appear functional if provider configuration is missing.

## 4. Security model

- Check authenticated user and group membership on the server before issuing call configuration.
- Use unpredictable room identifiers.
- A room name is not equivalent to authorization.
- Do not expose provider secrets in client code.
- If provider supports signed tokens or room access controls, use short-lived credentials minted server-side.
- Avoid putting private group names or student information in public room IDs.
- Do not store call recordings unless explicitly designed, consented to, and secured.

For a public Jitsi room integration, carefully evaluate how room names, moderation, authentication, and guest access work. If the public deployment cannot meet required privacy controls, use a different provider or self-hosted deployment before claiming private calls.

## 5. Low-bandwidth considerations

- Offer audio-only participation where supported.
- Keep the surrounding app lightweight.
- Avoid loading large media previews during a call.
- Show a clear “connection may be unstable” recovery state.
- Test switching networks and reconnecting.
- Don't promise calls continue in the background on every mobile browser.

## 6. Architecture

Create a call-provider adapter with a narrow interface, for example:
- create or resolve session room
- authorize participant
- return client-safe join configuration
- end/update session metadata if supported

Provider-specific code must not leak into unrelated group UI components.

## 7. Acceptance criteria

- Authorized group member can join a configured call.
- Non-member cannot obtain authorized session configuration.
- Missing provider configuration produces a clear message.
- User can leave a call and return to the group.
- Mobile permissions and reconnection are tested.
- The app accurately communicates third-party service use and limitations.
