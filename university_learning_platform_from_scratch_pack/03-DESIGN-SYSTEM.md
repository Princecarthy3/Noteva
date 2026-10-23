# Stage 3 — Design System and UI Foundation

## 1. Visual direction

Create a modern, calm, premium academic workspace. The interface should feel friendly and focused rather than childish or overly corporate.

Suggested starting palette:
- Primary violet: `#7C3AED`
- Dark violet: `#5B21B6`
- Light violet surface: `#F5F3FF`
- Background: white or a very light neutral
- Main text: deep slate
- Muted text: accessible neutral gray
- Borders: soft neutral gray

Use theme tokens rather than scattering raw color values across components. Check contrast and support both light/dark mode only if it can be implemented cleanly; light mode is the initial priority.

## 2. Layout

Desktop:
- Sidebar with product mark, primary navigation, and profile/settings area.
- Main content area with clear page title and primary action.
- Optional contextual panel only when it adds real value.
- Avoid overloading every screen with cards.

Mobile:
- Compact header and bottom navigation or a well-designed collapsible menu.
- Full-width forms and touch-friendly actions.
- No horizontal overflow.
- Upload and recording flows should be tested on mobile browsers.

## 3. Reusable components

Build a consistent set:
- `Button`
- `Input`
- `Textarea`
- `Select`
- `Dialog` or accessible modal
- `Card`
- `Badge`
- `Tabs`
- `Avatar`
- `DropdownMenu`
- `Skeleton`
- `EmptyState`
- `ErrorState`
- `Toast` or inline status message
- `PageHeader`
- `AppSidebar`
- `MobileNavigation`
- `FileUpload`
- `ProcessingStatus`
- `ConfirmDialog`

Reuse existing component libraries if present and appropriate. Do not install a UI library just for one component.

## 4. UX states

Every data-driven screen needs:
- Loading state
- Empty state with a useful next action
- Error state with retry or recovery guidance
- Success state
- Permission-denied state where relevant
- Processing state for asynchronous work

Do not use spinners indefinitely. Display useful progress/status text where possible.

## 5. Accessibility

- Use semantic HTML and labels.
- Inputs must have visible labels or reliable accessible names.
- Keyboard focus must be visible.
- Dialogs must support keyboard navigation and correct focus behavior.
- Don't rely on color alone to communicate errors or statuses.
- Respect reduced-motion preferences.
- Use descriptive text for icon-only buttons.
- Maintain reasonable contrast.

## 6. Content and product tone

Use clear language aimed at university students.
- Prefer “Upload lecture” over technical backend language.
- Explain processing delays and limitations honestly.
- Avoid fake urgency, fabricated progress, or invented AI certainty.
- Keep destructive actions explicit and confirm them.

## 7. Acceptance criteria

- All core pages share a consistent visual system.
- Layout works at narrow phone widths, tablet widths, and desktop.
- Keyboard navigation and labels are checked.
- Loading, empty, and error states are visible and useful.
