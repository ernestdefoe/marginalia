import app from 'flarum/admin/app';

app.initializers.add('ernestdefoe-marginalia', () => {
  app.extensionData
    .for('ernestdefoe-marginalia')
    .registerPermission(
      {
        icon: 'fas fa-highlighter',
        label: app.translator.trans('ernestdefoe-marginalia.admin.permissions.highlight_label'),
        permission: 'marginalia.highlight',
      },
      'start',
      95
    )
    .registerPermission(
      {
        icon: 'fas fa-eraser',
        label: app.translator.trans('ernestdefoe-marginalia.admin.permissions.moderate_label'),
        permission: 'marginalia.moderate',
      },
      'moderate',
      95
    );
});
