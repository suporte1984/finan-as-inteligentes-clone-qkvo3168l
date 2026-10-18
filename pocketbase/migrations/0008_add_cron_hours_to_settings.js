migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('settings')

    if (!settingsCol.fields.getByName('bills_reminder_hour')) {
      settingsCol.fields.add(
        new NumberField({
          name: 'bills_reminder_hour',
          min: 0,
          max: 23,
          onlyInt: true,
        }),
      )
    }

    if (!settingsCol.fields.getByName('ai_report_hour')) {
      settingsCol.fields.add(
        new NumberField({
          name: 'ai_report_hour',
          min: 0,
          max: 23,
          onlyInt: true,
        }),
      )
    }

    app.save(settingsCol)

    // Preencher default 9 para registros existentes em settings
    const existing = app.findRecordsByFilter('settings', '', 'created', 1000, 0)
    for (let i = 0; i < existing.length; i++) {
      const rec = existing[i]
      let changed = false
      if (
        rec.get('bills_reminder_hour') === null ||
        rec.get('bills_reminder_hour') === undefined ||
        rec.get('bills_reminder_hour') === ''
      ) {
        rec.set('bills_reminder_hour', 9)
        changed = true
      }
      if (
        rec.get('ai_report_hour') === null ||
        rec.get('ai_report_hour') === undefined ||
        rec.get('ai_report_hour') === ''
      ) {
        rec.set('ai_report_hour', 9)
        changed = true
      }
      if (changed) {
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      if (settingsCol.fields.getByName('bills_reminder_hour')) {
        settingsCol.fields.removeByName('bills_reminder_hour')
      }
      if (settingsCol.fields.getByName('ai_report_hour')) {
        settingsCol.fields.removeByName('ai_report_hour')
      }
      app.save(settingsCol)
    } catch (_) {}
  },
)
