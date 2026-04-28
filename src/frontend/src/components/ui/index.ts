// Compatibility shim — legacy callers import from components/ui.
// Plan 2 will migrate these imports to components/primitives directly.
export { Button } from '../primitives/Button';
export { Card }   from '../primitives/Card';
// Spinner is gone in the new system; consumers move to <Skeleton /> in Plan 2.
