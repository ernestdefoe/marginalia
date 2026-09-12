import app from 'flarum/admin/app';
import Admin from 'flarum/common/extenders/Admin';

/**
 * Marginalia's permissions.
 *
 * 🚨 An Admin extender, never `app.extensionData.for(...)` in an initializer.
 *
 * That was the Flarum 1 API. In Flarum 2 the property is GONE — not
 * deprecated, absent. It was renamed to `app.registry` and marked `@internal`,
 * so the extender is the supported way in.
 *
 * The old call failed quietly, which is why it survived a release: core wraps
 * every initializer in a try/catch, so the TypeError surfaced only as a toast
 * saying the extension "failed to initialize", and these two permissions
 * simply never reached the permissions grid. Highlighting kept working the
 * whole time, because the install migration grants `marginalia.highlight` to
 * Members — so the only visible symptom was an admin unable to give it to any
 * other group, or take it away.
 *
 * 🚨 Exported from js/src/admin/index.js and NOWHERE else. This file imports
 * `flarum/admin/app`, which does not exist on the forum frontend —
 * re-exporting it from the forum entry runs it during forum boot and takes
 * every page of the forum down, not just the admin panel.
 */
export default [
  new Admin()
    .permission(
      () => ({
        icon: 'fas fa-highlighter',
        label: app.translator.trans('ernestdefoe-marginalia.admin.permissions.highlight_label'),
        permission: 'marginalia.highlight',
      }),
      'start',
      95
    )
    .permission(
      () => ({
        icon: 'fas fa-eraser',
        label: app.translator.trans('ernestdefoe-marginalia.admin.permissions.moderate_label'),
        permission: 'marginalia.moderate',
      }),
      'moderate',
      95
    ),
];
