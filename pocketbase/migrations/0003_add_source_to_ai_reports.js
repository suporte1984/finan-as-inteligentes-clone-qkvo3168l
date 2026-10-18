migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ai_reports')
    if (!col.fields.getByName('source')) {
      col.fields.add(
        new SelectField({
          name: 'source',
          required: false,
          values: ['manual', 'auto'],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('ai_reports')
    const field = col.fields.getByName('source')
    if (field) {
      col.fields.removeByName('source')
      app.save(col)
    }
  },
)
